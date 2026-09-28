import re
import os

file_path = "backend/main_origin.py"
with open(file_path, "r") as f:
    code = f.read()

# 1. Imports
import_insert = """
from sqlmodel import SQLModel, Field, Session, create_engine, select
from sqlalchemy import Column, JSON
from zoneinfo import ZoneInfo
"""
code = code.replace("from pydantic import BaseModel\n", "from pydantic import BaseModel\n" + import_insert)

# 2. Database Engine
engine_insert = """
engine = create_engine(os.getenv("DATABASE_URL"))

def get_session():
    with Session(engine) as session:
        yield session
"""
code = code.replace("# --- Models ---", engine_insert + "\n# --- Models ---")

# 3. Models
models_replace = """
# --- Models ---
class AgentBase(BaseModel):
    name: str
    type: str 
    connection_type: str
    connection_config: Dict[str, Any] = {}

class Agent(AgentBase, SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    created_at: str = Field(default_factory=lambda: datetime.datetime.now(ZoneInfo('Asia/Kolkata')).isoformat())
    connection_config: dict = Field(default_factory=dict, sa_column=Column(JSON))

class PersonaBase(BaseModel):
    name: str
    background: str
    tone: str

class Persona(PersonaBase, SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    created_at: str = Field(default_factory=lambda: datetime.datetime.now(ZoneInfo('Asia/Kolkata')).isoformat())

class TestCase(BaseModel):
    scenario: str
    expected_outcome: str

class TestSetBase(BaseModel):
    name: str
    description: str
    test_cases: List[dict]

class TestSet(TestSetBase, SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    created_at: str = Field(default_factory=lambda: datetime.datetime.now(ZoneInfo('Asia/Kolkata')).isoformat())
    test_cases: list = Field(default_factory=list, sa_column=Column(JSON))

class MetricBase(BaseModel):
    name: str
    type: str 
    criteria: str

class Metric(MetricBase, SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    created_at: str = Field(default_factory=lambda: datetime.datetime.now(ZoneInfo('Asia/Kolkata')).isoformat())

class ConversationBase(BaseModel):
    transcript: List[dict]
    metric_ids: List[str]

class Conversation(ConversationBase, SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    created_at: str = Field(default_factory=lambda: datetime.datetime.now(ZoneInfo('Asia/Kolkata')).isoformat())
    transcript: list = Field(default_factory=list, sa_column=Column(JSON))
    metric_ids: list = Field(default_factory=list, sa_column=Column(JSON))
    results: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    has_audio: Optional[bool] = Field(default=True)

class SimulationBase(BaseModel):
    agent_id: str
    persona_id: str
    test_set_id: str
    metric_ids: List[str]
    mutations: Optional[Dict[str, Any]] = None

class Simulation(SimulationBase, SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    status: str
    created_at: str = Field(default_factory=lambda: datetime.datetime.now(ZoneInfo('Asia/Kolkata')).isoformat())
    metric_ids: list = Field(default_factory=list, sa_column=Column(JSON))
    mutations: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    results: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    transcript: Optional[list] = Field(default=None, sa_column=Column(JSON))
    has_audio: Optional[bool] = Field(default=True)

class ScheduleBase(BaseModel):
    name: str
    cron: str
    agent_id: str
    persona_id: str
    test_set_id: str
    metric_ids: List[str]

class Schedule(ScheduleBase, SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    created_at: str = Field(default_factory=lambda: datetime.datetime.now(ZoneInfo('Asia/Kolkata')).isoformat())
    next_run_at: str
    metric_ids: list = Field(default_factory=list, sa_column=Column(JSON))
    
class TraceBase(BaseModel):
    run_id: str
    spans: List[dict]

class Trace(TraceBase, SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    created_at: str = Field(default_factory=lambda: datetime.datetime.now(ZoneInfo('Asia/Kolkata')).isoformat())
    spans: list = Field(default_factory=list, sa_column=Column(JSON))

class ReviewOverride(BaseModel):
    passed: bool
    human_reasoning: str
"""
code = re.sub(r"# --- Models ---.*?# --- Seed Initial Data for Maica Testing ---", models_replace + "\n# --- Seed Initial Data for Maica Testing ---", code, flags=re.DOTALL)

# 4. Remove JSON store saving but KEEP the functions so we don't accidentally delete anything
code = code.replace("def save_persistent_store():", "def save_persistent_store():\n    return\n")
code = code.replace("def load_persistent_store():", "def load_persistent_store():\n    return\n")

# Disable the globals initialization that overrides the DB logic
code = re.sub(r"agents_db: List\[Agent\] = list\(DEFAULT_AGENTS\).*?traces_db: List\[Trace\] = \[\]\n", "", code, flags=re.DOTALL)

# Update @app.on_event("startup")
startup_replace = """
@app.on_event("startup")
async def startup_event():
    SQLModel.metadata.create_all(engine)
    load_persistent_store()
    asyncio.create_task(schedule_runner())
"""
code = re.sub(r"@app\.on_event\(\"startup\"\).*?asyncio\.create_task\(schedule_runner\(\)\)", startup_replace, code, flags=re.DOTALL)


# 5. Fix CRUD Endpoints
code = code.replace("def get_agents(): \n    return agents_db", "def get_agents():\n    with Session(engine) as session:\n        return session.exec(select(Agent)).all()")
code = code.replace("""def create_agent(agent: AgentBase):
    new_agent = Agent(id=str(uuid.uuid4()), **agent.model_dump(), created_at=datetime.datetime.now().isoformat())
    agents_db.append(new_agent)
    save_persistent_store()
    return new_agent""", """def create_agent(agent: AgentBase):
    with Session(engine) as session:
        new_agent = Agent(id=str(uuid.uuid4()), **agent.model_dump(), created_at=datetime.datetime.now(ZoneInfo('Asia/Kolkata')).isoformat())
        session.add(new_agent)
        session.commit()
        session.refresh(new_agent)
        return new_agent""")

code = code.replace("def get_personas(): \n    return personas_db", "def get_personas():\n    with Session(engine) as session:\n        return session.exec(select(Persona)).all()")
code = code.replace("""def create_persona(persona: PersonaBase):
    new_persona = Persona(id=str(uuid.uuid4()), **persona.model_dump(), created_at=datetime.datetime.now().isoformat())
    personas_db.append(new_persona)
    save_persistent_store()
    return new_persona""", """def create_persona(persona: PersonaBase):
    with Session(engine) as session:
        new_persona = Persona(id=str(uuid.uuid4()), **persona.model_dump(), created_at=datetime.datetime.now(ZoneInfo('Asia/Kolkata')).isoformat())
        session.add(new_persona)
        session.commit()
        session.refresh(new_persona)
        return new_persona""")

code = code.replace("def get_test_sets(): \n    return test_sets_db", "def get_test_sets():\n    with Session(engine) as session:\n        return session.exec(select(TestSet)).all()")
code = code.replace("""def create_test_set(test_set: TestSetBase):
    new_test_set = TestSet(id=str(uuid.uuid4()), **test_set.model_dump(), created_at=datetime.datetime.now().isoformat())
    test_sets_db.append(new_test_set)
    save_persistent_store()
    return new_test_set""", """def create_test_set(test_set: TestSetBase):
    with Session(engine) as session:
        new_test_set = TestSet(id=str(uuid.uuid4()), **test_set.model_dump(), created_at=datetime.datetime.now(ZoneInfo('Asia/Kolkata')).isoformat())
        session.add(new_test_set)
        session.commit()
        session.refresh(new_test_set)
        return new_test_set""")

code = code.replace("def get_metrics(): \n    return metrics_db", "def get_metrics():\n    with Session(engine) as session:\n        return session.exec(select(Metric)).all()")
code = code.replace("""def create_metric(metric: MetricBase):
    new_metric = Metric(id=str(uuid.uuid4()), **metric.model_dump(), created_at=datetime.datetime.now().isoformat())
    metrics_db.append(new_metric)
    save_persistent_store()
    return new_metric""", """def create_metric(metric: MetricBase):
    with Session(engine) as session:
        new_metric = Metric(id=str(uuid.uuid4()), **metric.model_dump(), created_at=datetime.datetime.now(ZoneInfo('Asia/Kolkata')).isoformat())
        session.add(new_metric)
        session.commit()
        session.refresh(new_metric)
        return new_metric""")

code = code.replace("def get_simulations(): \n    return simulations_db", "def get_simulations():\n    with Session(engine) as session:\n        return session.exec(select(Simulation).order_by(Simulation.created_at.desc())).all()")
code = code.replace("""def create_simulation(sim: SimulationBase, background_tasks: BackgroundTasks):
    new_sim = Simulation(
        id=str(uuid.uuid4()),
        **sim.model_dump(),
        status="running",
        created_at=datetime.datetime.now().isoformat()
    )
    simulations_db.insert(0, new_sim)
    save_persistent_store()
    background_tasks.add_task(run_simulation_engine, new_sim)
    return new_sim""", """def create_simulation(sim: SimulationBase, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        new_sim = Simulation(id=str(uuid.uuid4()), **sim.model_dump(), status="running", created_at=datetime.datetime.now(ZoneInfo('Asia/Kolkata')).isoformat())
        session.add(new_sim)
        session.commit()
        session.refresh(new_sim)
    background_tasks.add_task(run_simulation_engine, new_sim)
    return new_sim""")

code = code.replace("def get_conversations(): \n    return conversations_db", "def get_conversations():\n    with Session(engine) as session:\n        return session.exec(select(Conversation).order_by(Conversation.created_at.desc())).all()")
code = code.replace("""def create_conversation(conv: ConversationBase, background_tasks: BackgroundTasks):
    new_conv = Conversation(
        id=str(uuid.uuid4()), 
        **conv.model_dump(),
        created_at=datetime.datetime.now().isoformat()
    )
    conversations_db.insert(0, new_conv)
    save_persistent_store()
    background_tasks.add_task(run_conversation_evaluation, new_conv)
    return new_conv""", """def create_conversation(conv: ConversationBase, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        new_conv = Conversation(id=str(uuid.uuid4()), **conv.model_dump(), created_at=datetime.datetime.now(ZoneInfo('Asia/Kolkata')).isoformat())
        session.add(new_conv)
        session.commit()
        session.refresh(new_conv)
    background_tasks.add_task(run_conversation_evaluation, new_conv)
    return new_conv""")

code = code.replace("def get_schedules(): \n    return schedules_db", "def get_schedules():\n    with Session(engine) as session:\n        return session.exec(select(Schedule)).all()")
code = code.replace("""def create_schedule(sched: ScheduleBase):
    now = datetime.datetime.now()
    iter = croniter(sched.cron, now)
    next_run = iter.get_next(datetime.datetime).isoformat()
        
    new_schedule = Schedule(
        id=str(uuid.uuid4()), 
        **sched.model_dump(), 
        created_at=now.isoformat(),
        next_run_at=next_run
    )
    schedules_db.append(new_schedule)
    save_persistent_store()
    return new_schedule""", """def create_schedule(sched: ScheduleBase):
    now = datetime.datetime.now(ZoneInfo('Asia/Kolkata'))
    iter = croniter(sched.cron, now)
    next_run = iter.get_next(datetime.datetime).isoformat()
    with Session(engine) as session:
        new_schedule = Schedule(id=str(uuid.uuid4()), **sched.model_dump(), created_at=now.isoformat(), next_run_at=next_run)
        session.add(new_schedule)
        session.commit()
        session.refresh(new_schedule)
        return new_schedule""")

code = code.replace("""def delete_schedule(schedule_id: str):
    global schedules_db
    schedules_db = [s for s in schedules_db if s.id != schedule_id]
    save_persistent_store()
    return {"status": "ok"}""", """def delete_schedule(schedule_id: str):
    with Session(engine) as session:
        sched = session.get(Schedule, schedule_id)
        if sched:
            session.delete(sched)
            session.commit()
    return {"status": "ok"}""")

code = code.replace("""def get_traces_for_run(run_id: str):
    return [t for t in traces_db if t.run_id == run_id]""", """def get_traces_for_run(run_id: str):
    with Session(engine) as session:
        return session.exec(select(Trace).where(Trace.run_id == run_id)).all()""")

code = code.replace("""def upload_traces(trace: TraceBase):
    new_trace = Trace(
        id=str(uuid.uuid4()),
        **trace.model_dump(),
        created_at=datetime.datetime.now().isoformat()
    )
    traces_db.append(new_trace)
    save_persistent_store()
    return new_trace""", """def upload_traces(trace: TraceBase):
    with Session(engine) as session:
        new_trace = Trace(
            id=str(uuid.uuid4()),
            **trace.model_dump(),
            created_at=datetime.datetime.now(ZoneInfo('Asia/Kolkata')).isoformat()
        )
        session.add(new_trace)
        session.commit()
        session.refresh(new_trace)
        return new_trace""")

# Now replace the inner DB list accesses in the async functions!
code = code.replace("next((a for a in agents_db if a.id == sim.agent_id), None)", "session.get(Agent, sim.agent_id)")
code = code.replace("next((p for p in personas_db if p.id == sim.persona_id), None)", "session.get(Persona, sim.persona_id)")
code = code.replace("next((ts for ts in test_sets_db if ts.id == sim.test_set_id), None)", "session.get(TestSet, sim.test_set_id)")
code = code.replace("next((s for s in simulations_db if s.id == run_id), None)", "session.get(Simulation, run_id)")
code = code.replace("[m for m in metrics_db if m.id in sim.metric_ids]", "session.exec(select(Metric).where(Metric.id.in_(sim.metric_ids))).all()")
code = code.replace("[m for m in metrics_db if m.id in conv.metric_ids]", "session.exec(select(Metric).where(Metric.id.in_(conv.metric_ids))).all()")

code = code.replace("""    sim = next((s for s in simulations_db if s.id == run_id), None)
    if sim and sim.transcript:
        await generate_call_audio(run_id, sim.transcript)
    else:
        raise HTTPException(status_code=404, detail="Audio recording not available")""", """    with Session(engine) as session:
        sim = session.get(Simulation, run_id)
        if sim and sim.transcript:
            await generate_call_audio(run_id, sim.transcript)
        else:
            raise HTTPException(status_code=404, detail="Audio recording not available")""")

# Update schedule_runner inner loop
schedule_runner_replace = """
async def schedule_runner():
    while True:
        now = datetime.datetime.now(ZoneInfo('Asia/Kolkata'))
        with Session(engine) as session:
            schedules_db = session.exec(select(Schedule)).all()
            for sched in schedules_db:
                try:
                    next_run = datetime.datetime.fromisoformat(sched.next_run_at)
                    if now >= next_run:
                        sim_base = SimulationBase(
                            agent_id=sched.agent_id,
                            persona_id=sched.persona_id,
                            test_set_id=sched.test_set_id,
                            metric_ids=sched.metric_ids
                        )
                        sim = Simulation(id=str(uuid.uuid4()), **sim_base.model_dump(), status="running", created_at=now.isoformat())
                        session.add(sim)
                        session.commit()
                        asyncio.create_task(run_simulation_engine(sim))
                        
                        iter_obj = croniter(sched.cron, now)
                        sched.next_run_at = iter_obj.get_next(datetime.datetime).isoformat()
                        session.add(sched)
                        session.commit()
                except Exception as e:
                    print(f"Schedule error for {sched.id}: {e}")
        await asyncio.sleep(30)
"""
code = re.sub(r"async def schedule_runner\(\):.*?await asyncio\.sleep\(30\)", schedule_runner_replace, code, flags=re.DOTALL)

# Wrap run_simulation_engine and run_conversation_evaluation in DB session context
code = code.replace("async def run_simulation_engine(sim: Simulation):", "async def run_simulation_engine(sim: Simulation):\n    session = Session(engine)")
code = code.replace("async def run_conversation_evaluation(conv: Conversation):", "async def run_conversation_evaluation(conv: Conversation):\n    session = Session(engine)")


# For inner simulation_db.append updates, change to session commit
code = code.replace("simulations_db.append(sim)", "session.add(sim)\n                    session.commit()")
code = code.replace("simulations_db.insert(0, new_sim)", "pass")

# Fix all remaining datetime.datetime.now() inside the file
code = code.replace("datetime.datetime.now()", "datetime.datetime.now(ZoneInfo('Asia/Kolkata'))")

with open("backend/src/backend/main.py", "w") as f:
    f.write(code)
