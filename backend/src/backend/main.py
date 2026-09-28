import os
import json
import uuid
import datetime
import asyncio
import httpx
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from dotenv import load_dotenv

from openai import AsyncOpenAI
from croniter import croniter

from prometheus_client import make_asgi_app, Counter, Histogram
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.resources import Resource
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

from twilio.rest import Client as TwilioClient
from twilio.twiml.voice_response import VoiceResponse, Connect, Stream
import base64
import edge_tts
import io
import audioop
from pydub import AudioSegment

load_dotenv()

app = FastAPI(title="Coval Clone API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- OpenTelemetry Setup ---
resource = Resource(attributes={"service.name": "coval-clone-backend"})
trace.set_tracer_provider(TracerProvider(resource=resource))
tracer = trace.get_tracer(__name__)
# Send traces to Jaeger running via docker-compose
otlp_exporter = OTLPSpanExporter(endpoint="http://localhost:4318/v1/traces")
span_processor = BatchSpanProcessor(otlp_exporter)
trace.get_tracer_provider().add_span_processor(span_processor)

FastAPIInstrumentor.instrument_app(app)

# --- Prometheus Setup ---
evaluations_counter = Counter("coval_evaluations_total", "Total evaluations run", ["metric_name", "status"])
simulations_counter = Counter("coval_simulations_total", "Total simulations run", ["status"])

# Mount prometheus metrics endpoint
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)

# In-memory storage for our CRUD endpoints
agents_db = []
personas_db = []
test_sets_db = []
metrics_db = []
simulations_db = []
conversations_db = []
schedules_db = []
traces_db = []

# --- Models ---
class AgentBase(BaseModel):
    name: str
    type: str 
    connection_type: str
    connection_config: Dict[str, Any] = {}

class Agent(AgentBase):
    id: str
    created_at: str

class PersonaBase(BaseModel):
    name: str
    background: str
    tone: str

class Persona(PersonaBase):
    id: str
    created_at: str

class TestCase(BaseModel):
    scenario: str
    expected_outcome: str

class TestSetBase(BaseModel):
    name: str
    description: str
    test_cases: List[TestCase]

class TestSet(TestSetBase):
    id: str
    created_at: str

class MetricBase(BaseModel):
    name: str
    type: str 
    criteria: str

class Metric(MetricBase):
    id: str
    created_at: str

class ConversationBase(BaseModel):
    transcript: List[dict] # list of {"role": "agent"|"user", "text": "..."}
    metric_ids: List[str]

class Conversation(ConversationBase):
    id: str
    created_at: str
    results: Optional[dict] = None

class SimulationBase(BaseModel):
    agent_id: str
    persona_id: str
    test_set_id: str
    metric_ids: List[str]
    mutations: Optional[Dict[str, Any]] = None

class Simulation(SimulationBase):
    id: str
    status: str
    created_at: str
    results: Optional[dict] = None
    transcript: Optional[List[dict]] = None

class ScheduleBase(BaseModel):
    name: str
    cron_expression: str
    agent_id: str
    persona_id: str
    test_set_id: str
    metric_ids: List[str]

class Schedule(ScheduleBase):
    id: str
    created_at: str
    next_run_at: str
    
class TraceBase(BaseModel):
    run_id: str # simulation or conversation id
    spans: List[dict] # simplified OpenTelemetry spans

class Trace(TraceBase):
    id: str
    created_at: str

class ReviewOverride(BaseModel):
    passed: bool
    human_reasoning: str

# --- Engine Logic ---
# Use Groq for blazing fast, free-tier LLM inference
client = AsyncOpenAI(
    api_key=os.getenv("GROQ_API_KEY") or os.getenv("OPENAI_API_KEY"),
    base_url="https://api.groq.com/openai/v1" if os.getenv("GROQ_API_KEY") else "https://api.openai.com/v1"
)

async def generate_persona_response(persona: Persona, scenario: str, transcript: list) -> str:
    messages = [
        {"role": "system", "content": f"You are playing the role of a user talking to an AI agent. \n\nBackground: {persona.background}\nTone: {persona.tone}\n\nYour Goal/Scenario: {scenario}\n\nKeep your responses short and conversational, like a real human. If the agent resolves your scenario or goal, say '[END CONVERSATION]' at the end of your message."}
    ]
    for msg in transcript:
        messages.append({"role": "user" if msg["role"] == "agent" else "assistant", "content": msg["text"]})
        
    try:
        response = await client.chat.completions.create(
            model="llama-3.1-8b-instant" if os.getenv("GROQ_API_KEY") else "gpt-4o-mini",
            messages=messages,
            temperature=0.7,
        )
        return response.choices[0].message.content or ""
    except Exception as e:
        print(f"Error calling LLM for persona: {e}")
        return "I'm having trouble responding right now."

async def generate_agent_response(agent: Agent, transcript: list) -> str:
    if agent.connection_type == "internal":
        system_prompt = agent.connection_config.get("system_prompt", "You are a helpful assistant.")
        messages = [{"role": "system", "content": system_prompt}]
        for msg in transcript:
            messages.append({"role": "user" if msg["role"] == "persona" else "assistant", "content": msg["text"]})
        
        try:
            response = await client.chat.completions.create(
                model="llama-3.1-8b-instant" if os.getenv("GROQ_API_KEY") else "gpt-4o-mini",
                messages=messages,
                temperature=0.2,
            )
            return response.choices[0].message.content or ""
        except Exception as e:
            return f"Agent Error: {e}"
            
    elif agent.connection_type == "rest_api":
        url = agent.connection_config.get("endpoint_url")
        api_key = agent.connection_config.get("api_key")
        
        if not url:
            return "[Agent Error] No endpoint URL configured."
            
        headers = {"Content-Type": "application/json"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
            
        payload = {
            "messages": transcript,
            "agent_name": agent.name
        }
        
        try:
            async with httpx.AsyncClient() as http_client:
                resp = await http_client.post(url, json=payload, headers=headers, timeout=15.0)
                resp.raise_for_status()
                data = resp.json()
                
                # Try common response formats
                return data.get("text") or data.get("response") or data.get("message") or str(data)
        except Exception as e:
            return f"[REST API Error] Failed to reach external agent: {e}"
            
    elif agent.connection_type == "phone":
        return f"[Simulated Twilio Voice Response dialing {agent.connection_config.get('phone_number')}] Hello!"
    
    return "[Simulated Generic Response]"

async def evaluate_metric(metric: Metric, transcript: list, test_case: TestCase) -> dict:
    transcript_text = "\n".join([f"{m['role'].upper()}: {m['text']}" for m in transcript])
    
    prompt = f"""You are an expert AI evaluator judging an agent conversation.
    
Test Case Scenario: {test_case.scenario}
Expected Outcome: {test_case.expected_outcome}

Metric to Evaluate: {metric.name} ({metric.type})
Criteria: {metric.criteria}

Transcript:
{transcript_text}

Evaluate the transcript against the criteria. 
Respond ONLY with a valid JSON object in the following format:
{{
    "passed": true/false,
    "score": float between 0.0 and 1.0,
    "reasoning": "Detailed explanation of why it passed or failed."
}}
"""
    try:
        response = await client.chat.completions.create(
            model="llama-3.1-70b-versatile" if os.getenv("GROQ_API_KEY") else "gpt-4o",
            messages=[{"role": "system", "content": prompt}],
            response_format={ "type": "json_object" },
            temperature=0.1,
        )
        result = json.loads(response.choices[0].message.content)
        return {
            "name": metric.name,
            "passed": result.get("passed", False),
            "score": result.get("score", 0.0),
            "human_reviewed": False
        }
    except Exception as e:
        print(f"Error evaluating metric {metric.name}: {e}")
        return {
            "name": metric.name,
            "passed": False,
            "score": 0.0,
            "reasoning": f"Evaluation engine failed to process metric: {e}",
            "human_reviewed": False
        }

async def run_simulation_engine(sim: Simulation):
    agent = next((a for a in agents_db if a.id == sim.agent_id), None)
    persona = next((p for p in personas_db if p.id == sim.persona_id), None)
    test_set = next((ts for ts in test_sets_db if ts.id == sim.test_set_id), None)
    metrics = [m for m in metrics_db if m.id in sim.metric_ids]

    with tracer.start_as_current_span("run_simulation_engine") as span:
        span.set_attribute("simulation.id", sim.id)
        span.set_attribute("agent.id", sim.agent_id)

        if not agent or not persona or not test_set:
            sim.status = "failed"
            sim.results = {"error": "Missing entities"}
            simulations_counter.labels(status="failed").inc()
            return
            
        # Apply mutations to a copy of the agent
        mutated_agent = agent.model_copy(deep=True)
        if sim.mutations:
            for k, v in sim.mutations.items():
                if k in mutated_agent.connection_config:
                    mutated_agent.connection_config[k] = v
                # If the user overrides something at the root like name
                if hasattr(mutated_agent, k):
                    setattr(mutated_agent, k, v)
            
        test_case = test_set.test_cases[0] if test_set.test_cases else TestCase(scenario="Have a generic conversation", expected_outcome="Conversation ends")
        transcript = []
        
        # Let the Persona start the conversation
        with tracer.start_as_current_span("generate_persona_response"):
            first_msg = await generate_persona_response(persona, test_case.scenario, [])
        if "[END CONVERSATION]" in first_msg:
            first_msg = first_msg.replace("[END CONVERSATION]", "").strip()
            end = True
        else:
            end = False
        
        if first_msg:
            transcript.append({"role": "persona", "text": first_msg})
        
        # Interaction Loop (max 5 turns to prevent infinite loops)
        for _ in range(5):
            if end:
                break
                
            with tracer.start_as_current_span("generate_agent_response"):
                agent_reply = await generate_agent_response(mutated_agent, transcript)
            if agent_reply:
                transcript.append({"role": "agent", "text": agent_reply})
            
            with tracer.start_as_current_span("generate_persona_response"):
                persona_reply = await generate_persona_response(persona, test_case.scenario, transcript)
            if "[END CONVERSATION]" in persona_reply:
                persona_reply = persona_reply.replace("[END CONVERSATION]", "").strip()
                end = True
                
            if persona_reply:
                transcript.append({"role": "persona", "text": persona_reply})

        sim.transcript = transcript

        # Evaluation Phase
        evaluation_results = {}
        for m in metrics:
            with tracer.start_as_current_span("evaluate_metric") as eval_span:
                eval_span.set_attribute("metric.name", m.name)
                res = await evaluate_metric(m, transcript, test_case)
                evaluation_results[m.id] = res
                
                # Prometheus Metric
                status_label = "pass" if res["passed"] else "fail"
                evaluations_counter.labels(metric_name=m.name, status=status_label).inc()

        sim.status = "completed"
        sim.results = evaluation_results
        simulations_counter.labels(status="completed").inc()


# --- Background Scheduler Loop ---
async def schedule_runner():
    """Mock background job runner for Schedules"""
    while True:
        now = datetime.datetime.now()
        for sched in schedules_db:
            try:
                next_run = datetime.datetime.fromisoformat(sched.next_run_at)
                if now >= next_run:
                    # Time to run!
                    sim_base = SimulationBase(
                        agent_id=sched.agent_id,
                        persona_id=sched.persona_id,
                        test_set_id=sched.test_set_id,
                        metric_ids=sched.metric_ids
                    )
                    sim = Simulation(id=str(uuid.uuid4()), **sim_base.model_dump(), status="running", created_at=now.isoformat())
                    simulations_db.append(sim)
                    # Trigger run (synchronously here just to simplify the asyncio task management in this clone)
                    asyncio.create_task(run_simulation_engine(sim))
                    
                    # Update next run time
                    itr = croniter(sched.cron_expression, now)
                    sched.next_run_at = itr.get_next(datetime.datetime).isoformat()
            except Exception as e:
                print(f"Schedule error for {sched.id}: {e}")
        await asyncio.sleep(10) # check every 10 seconds for demo

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(schedule_runner())


# --- Endpoints ---
@app.get("/")
def read_root():
    return {"message": "Welcome to the Coval Clone Backend"}

@app.get("/api/agents", response_model=List[Agent])
def get_agents(): return agents_db
@app.post("/api/agents", response_model=Agent)
def create_agent(agent: AgentBase):
    new_agent = Agent(id=str(uuid.uuid4()), **agent.model_dump(), created_at=datetime.datetime.now().isoformat())
    agents_db.append(new_agent)
    return new_agent

@app.get("/api/personas", response_model=List[Persona])
def get_personas(): return personas_db
@app.post("/api/personas", response_model=Persona)
def create_persona(persona: PersonaBase):
    new_persona = Persona(id=str(uuid.uuid4()), **persona.model_dump(), created_at=datetime.datetime.now().isoformat())
    personas_db.append(new_persona)
    return new_persona

# --- Twilio Voice Integration ---

class CallRequest(BaseModel):
    agent_id: str
    phone_number: str

@app.post("/api/call")
def initiate_call(req: CallRequest):
    """Initiates an outbound call to the target phone number using Twilio."""
    account_sid = os.getenv("TWILIO_ACCOUNT_SID")
    auth_token = os.getenv("TWILIO_AUTH_TOKEN")
    twilio_number = os.getenv("TWILIO_PHONE_NUMBER")
    ngrok_url = os.getenv("NGROK_BACKEND_URL", "your-ngrok-url.ngrok-free.app") # Must not include https://

    if not all([account_sid, auth_token, twilio_number]):
        raise HTTPException(status_code=500, detail="Twilio credentials missing in .env")

    client = TwilioClient(account_sid, auth_token)

    # We use a TwiML Bin or dynamically generate TwiML to connect the call to our WebSocket
    response = VoiceResponse()
    connect = Connect()
    connect.stream(url=f"wss://{ngrok_url}/media")
    response.append(connect)

    try:
        call = client.calls.create(
            twiml=str(response),
            to=req.phone_number,
            from_=twilio_number
        )
        return {"status": "calling", "call_sid": call.sid}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.websocket("/media")
async def websocket_endpoint(websocket: WebSocket):
    """Receives real-time audio from Twilio and processes it."""
    await websocket.accept()
    print("WebSocket connection accepted from Twilio")
    
    stream_sid = None
    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            
            if msg["event"] == "start":
                stream_sid = msg["start"]["streamSid"]
                print(f"Started Twilio Media Stream: {stream_sid}")
                # Optional: Send an initial greeting from ElevenLabs TTS here
                
            elif msg["event"] == "media":
                payload = msg["media"]["payload"] # Base64 encoded mu-law audio
                audio_bytes = base64.b64decode(payload)
                
                # --- AUDIO PROCESSING PIPELINE ---
                # 1. Decode Twilio's u-law audio to raw PCM so Whisper can understand it
                # In a real app you'd buffer chunks to form sentences. Here is the flow for a buffered chunk:
                # 
                # pcm_audio = audioop.ulaw2lin(audio_bytes, 2)
                # audio_segment = AudioSegment(data=pcm_audio, sample_width=2, frame_rate=8000, channels=1)
                # wav_io = io.BytesIO()
                # audio_segment.export(wav_io, format="wav")
                # wav_io.name = "audio.wav"
                
                # 2. STT via Groq's Whisper API (Free & Fast)
                # transcription = await client.audio.transcriptions.create(
                #     file=wav_io,
                #     model="whisper-large-v3",
                #     response_format="text"
                # )
                
                # 3. Get LLM response
                # persona_text = await generate_persona_response(...)
                
                # 4. TTS via Edge-TTS (Free, High Quality Microsoft Voices)
                # tts_io = io.BytesIO()
                # communicate = edge_tts.Communicate(persona_text, "en-US-AriaNeural")
                # async for chunk in communicate.stream():
                #     if chunk["type"] == "audio":
                #         tts_io.write(chunk["data"])
                
                # 5. Convert Edge-TTS MP3 back to Twilio's 8000Hz u-law
                # tts_io.seek(0)
                # out_audio = AudioSegment.from_file(tts_io, format="mp3")
                # out_audio = out_audio.set_frame_rate(8000).set_channels(1)
                # ulaw_bytes = audioop.lin2ulaw(out_audio.raw_data, 2)
                
                # 6. Stream back to Twilio
                # await websocket.send_json({
                #     "event": "media",
                #     "streamSid": stream_sid,
                #     "media": {"payload": base64.b64encode(ulaw_bytes).decode('utf-8')}
                # })
                
            elif msg["event"] == "stop":
                print("Twilio Media Stream stopped")
                break
                
    except WebSocketDisconnect:
        print("WebSocket disconnected")
    except Exception as e:
        print(f"WebSocket error: {e}")


@app.get("/api/test-sets", response_model=List[TestSet])
def get_test_sets(): return test_sets_db
@app.post("/api/test-sets", response_model=TestSet)
def create_test_set(test_set: TestSetBase):
    new_test_set = TestSet(id=str(uuid.uuid4()), **test_set.model_dump(), created_at=datetime.datetime.now().isoformat())
    test_sets_db.append(new_test_set)
    return new_test_set

class GenerateRequest(BaseModel):
    description: str

@app.post("/api/test-sets/generate")
async def generate_test_cases(req: GenerateRequest):
    prompt = f"""Generate 3 diverse testing scenarios for an AI agent based on this description: {req.description}. 
    Make sure to include edge cases.
    Respond ONLY with a valid JSON object matching this schema:
    {{
        "test_cases": [
            {{"scenario": "...", "expected_outcome": "..."}}
        ]
    }}"""
    try:
        response = await client.chat.completions.create(
            model="llama-3.1-8b-instant" if os.getenv("GROQ_API_KEY") else "gpt-4o-mini",
            messages=[{"role": "system", "content": prompt}],
            response_format={ "type": "json_object" },
            temperature=0.7,
        )
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/metrics", response_model=List[Metric])
def get_metrics(): return metrics_db
@app.post("/api/metrics", response_model=Metric)
def create_metric(metric: MetricBase):
    new_metric = Metric(id=str(uuid.uuid4()), **metric.model_dump(), created_at=datetime.datetime.now().isoformat())
    metrics_db.append(new_metric)
    return new_metric

@app.get("/api/simulations", response_model=List[Simulation])
def get_simulations(): return simulations_db
@app.post("/api/simulations", response_model=Simulation)
def create_simulation(sim: SimulationBase, background_tasks: BackgroundTasks):
    new_sim = Simulation(id=str(uuid.uuid4()), **sim.model_dump(), status="running", created_at=datetime.datetime.now().isoformat())
    simulations_db.append(new_sim)
    background_tasks.add_task(run_simulation_engine, new_sim)
    return new_sim


# --- Live Conversations ---
@app.get("/api/conversations", response_model=List[Conversation])
def get_conversations(): return conversations_db

async def evaluate_live_conversation(conv: Conversation):
    conv_metrics = [m for m in metrics_db if m.id in conv.metric_ids]
    # For live conversations, we don't have a specific test case scenario to anchor to
    mock_test_case = TestCase(scenario="Live Production Call", expected_outcome="Satisfy the user")
    
    with tracer.start_as_current_span("evaluate_live_conversation") as span:
        span.set_attribute("conversation.id", conv.id)
        
        evaluation_results = {}
        for m in conv_metrics:
            with tracer.start_as_current_span("evaluate_metric") as eval_span:
                eval_span.set_attribute("metric.name", m.name)
                res = await evaluate_metric(m, conv.transcript, mock_test_case)
                evaluation_results[m.id] = res
                
                # Prometheus Metric
                status_label = "pass" if res["passed"] else "fail"
                evaluations_counter.labels(metric_name=m.name, status=status_label).inc()
                
        conv.results = evaluation_results

@app.post("/api/conversations", response_model=Conversation)
def create_conversation(conv: ConversationBase, background_tasks: BackgroundTasks):
    new_conv = Conversation(id=str(uuid.uuid4()), **conv.model_dump(), created_at=datetime.datetime.now().isoformat())
    conversations_db.append(new_conv)
    background_tasks.add_task(evaluate_live_conversation, new_conv)
    return new_conv


# --- Scheduled Runs ---
@app.get("/api/schedules", response_model=List[Schedule])
def get_schedules(): return schedules_db

@app.post("/api/schedules", response_model=Schedule)
def create_schedule(sched: ScheduleBase):
    try:
        now = datetime.datetime.now()
        itr = croniter(sched.cron_expression, now)
        next_run = itr.get_next(datetime.datetime)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid cron expression: {e}")
        
    new_sched = Schedule(
        id=str(uuid.uuid4()), 
        **sched.model_dump(), 
        created_at=now.isoformat(),
        next_run_at=next_run.isoformat()
    )
    schedules_db.append(new_sched)
    return new_sched

@app.delete("/api/schedules/{schedule_id}")
def delete_schedule(schedule_id: str):
    global schedules_db
    schedules_db = [s for s in schedules_db if s.id != schedule_id]
    return {"status": "ok"}


# --- OpenTelemetry Traces ---
@app.get("/api/traces/{run_id}", response_model=List[Trace])
def get_traces_for_run(run_id: str):
    return [t for t in traces_db if t.run_id == run_id]

@app.post("/api/traces", response_model=Trace)
def upload_traces(trace: TraceBase):
    new_trace = Trace(
        id=str(uuid.uuid4()),
        **trace.model_dump(),
        created_at=datetime.datetime.now().isoformat()
    )
    traces_db.append(new_trace)
    return new_trace


# --- Human Review ---
@app.post("/api/reviews/{run_id}/{metric_id}")
def override_metric_review(run_id: str, metric_id: str, override: ReviewOverride):
    # Find the run (could be simulation or conversation)
    run = next((s for s in simulations_db if s.id == run_id), None)
    if not run:
        run = next((c for c in conversations_db if c.id == run_id), None)
        
    if not run or not run.results or metric_id not in run.results:
        raise HTTPException(status_code=404, detail="Run or Metric not found")
        
    # Update the result with human override
    run.results[metric_id]["passed"] = override.passed
    run.results[metric_id]["score"] = 1.0 if override.passed else 0.0
    run.results[metric_id]["human_reasoning"] = override.human_reasoning
    run.results[metric_id]["human_reviewed"] = True
    
    return {"status": "ok", "new_result": run.results[metric_id]}


# --- Dashboard Stats ---
@app.get("/api/stats")
def get_stats():
    total_sims = len(simulations_db)
    total_convs = len(conversations_db)
    
    passed_metrics = 0
    total_metrics = 0
    human_reviews = 0
    
    for sim in simulations_db:
        if sim.results and "error" not in sim.results:
            for m_id, res in sim.results.items():
                total_metrics += 1
                if res.get("passed"): passed_metrics += 1
                if res.get("human_reviewed"): human_reviews += 1
                
    for conv in conversations_db:
        if conv.results:
            for m_id, res in conv.results.items():
                total_metrics += 1
                if res.get("passed"): passed_metrics += 1
                if res.get("human_reviewed"): human_reviews += 1
                
    pass_rate = (passed_metrics / total_metrics * 100) if total_metrics > 0 else 0
    
    return {
        "total_simulations": total_sims,
        "total_live_conversations": total_convs,
        "total_agents": len(agents_db),
        "total_metrics_evaluated": total_metrics,
        "human_reviews": human_reviews,
        "global_pass_rate": round(pass_rate, 1)
    }
