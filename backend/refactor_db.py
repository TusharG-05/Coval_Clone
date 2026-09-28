import re

with open("src/backend/main.py", "r") as f:
    code = f.read()

# 1. Add SQLModel imports
import_insert = """
from sqlmodel import SQLModel, Field, Session, create_engine, select
from sqlalchemy import Column, JSON
"""
code = code.replace("from pydantic import BaseModel\n", "from pydantic import BaseModel\n" + import_insert)

# 2. Add Engine
engine_insert = """
engine = create_engine(os.getenv("DATABASE_URL"))

def get_session():
    with Session(engine) as session:
        yield session
"""
code = code.replace("# In-memory storage for our CRUD endpoints", engine_insert + "\n# In-memory storage for our CRUD endpoints")

# Remove global lists
code = re.sub(r"agents_db = \[\]\n.*traces_db = \[\]\n", "", code, flags=re.DOTALL)

# 3. Refactor Models
models_replace = """
# --- Models ---
class AgentBase(BaseModel):
    name: str
    type: str 
    connection_type: str
    connection_config: Dict[str, Any] = {}

class Agent(AgentBase, SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    created_at: str = Field(default_factory=lambda: datetime.datetime.now().isoformat())
    connection_config: dict = Field(default_factory=dict, sa_column=Column(JSON))

class PersonaBase(BaseModel):
    name: str
    background: str
    tone: str

class Persona(PersonaBase, SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    created_at: str = Field(default_factory=lambda: datetime.datetime.now().isoformat())

class TestCase(BaseModel):
    scenario: str
    expected_outcome: str

class TestSetBase(BaseModel):
    name: str
    description: str
    test_cases: List[dict]

class TestSet(TestSetBase, SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    created_at: str = Field(default_factory=lambda: datetime.datetime.now().isoformat())
    test_cases: list = Field(default_factory=list, sa_column=Column(JSON))

class MetricBase(BaseModel):
    name: str
    type: str 
    criteria: str

class Metric(MetricBase, SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    created_at: str = Field(default_factory=lambda: datetime.datetime.now().isoformat())

class ConversationBase(BaseModel):
    transcript: List[dict]
    metric_ids: List[str]

class Conversation(ConversationBase, SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    created_at: str = Field(default_factory=lambda: datetime.datetime.now().isoformat())
    transcript: list = Field(default_factory=list, sa_column=Column(JSON))
    metric_ids: list = Field(default_factory=list, sa_column=Column(JSON))
    results: Optional[dict] = Field(default=None, sa_column=Column(JSON))

class SimulationBase(BaseModel):
    agent_id: str
    persona_id: str
    test_set_id: str
    metric_ids: List[str]
    mutations: Optional[Dict[str, Any]] = None

class Simulation(SimulationBase, SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    status: str
    created_at: str = Field(default_factory=lambda: datetime.datetime.now().isoformat())
    metric_ids: list = Field(default_factory=list, sa_column=Column(JSON))
    mutations: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    results: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    transcript: Optional[list] = Field(default=None, sa_column=Column(JSON))

class ScheduleBase(BaseModel):
    name: str
    cron_expression: str
    agent_id: str
    persona_id: str
    test_set_id: str
    metric_ids: List[str]

class Schedule(ScheduleBase, SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    created_at: str = Field(default_factory=lambda: datetime.datetime.now().isoformat())
    next_run_at: str
    metric_ids: list = Field(default_factory=list, sa_column=Column(JSON))
    
class TraceBase(BaseModel):
    run_id: str
    spans: List[dict]

class Trace(TraceBase, SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    created_at: str = Field(default_factory=lambda: datetime.datetime.now().isoformat())
    spans: list = Field(default_factory=list, sa_column=Column(JSON))

class ReviewOverride(BaseModel):
    passed: bool
    human_reasoning: str
"""
code = re.sub(r"# --- Models ---.*?# --- Engine Logic ---", models_replace + "\n# --- Engine Logic ---", code, flags=re.DOTALL)

# 4. Refactor Startup
startup_replace = """
@app.on_event("startup")
async def startup_event():
    SQLModel.metadata.create_all(engine)
    asyncio.create_task(schedule_runner())
"""
code = re.sub(r"@app\.on_event\(\"startup\"\).*?asyncio\.create_task\(schedule_runner\(\)\)", startup_replace, code, flags=re.DOTALL)

# 5. Refactor Endpoints
code = code.replace("def get_agents(): return agents_db", "def get_agents():\n    with Session(engine) as session:\n        return session.exec(select(Agent)).all()")
code = code.replace("""def create_agent(agent: AgentBase):
    new_agent = Agent(id=str(uuid.uuid4()), **agent.model_dump(), created_at=datetime.datetime.now().isoformat())
    agents_db.append(new_agent)
    return new_agent""", """def create_agent(agent: AgentBase):
    with Session(engine) as session:
        new_agent = Agent(id=str(uuid.uuid4()), **agent.model_dump(), created_at=datetime.datetime.now().isoformat())
        session.add(new_agent)
        session.commit()
        session.refresh(new_agent)
        return new_agent""")

code = code.replace("def get_personas(): return personas_db", "def get_personas():\n    with Session(engine) as session:\n        return session.exec(select(Persona)).all()")
code = code.replace("""def create_persona(persona: PersonaBase):
    new_persona = Persona(id=str(uuid.uuid4()), **persona.model_dump(), created_at=datetime.datetime.now().isoformat())
    personas_db.append(new_persona)
    return new_persona""", """def create_persona(persona: PersonaBase):
    with Session(engine) as session:
        new_persona = Persona(id=str(uuid.uuid4()), **persona.model_dump(), created_at=datetime.datetime.now().isoformat())
        session.add(new_persona)
        session.commit()
        session.refresh(new_persona)
        return new_persona""")

code = code.replace("def get_test_sets(): return test_sets_db", "def get_test_sets():\n    with Session(engine) as session:\n        return session.exec(select(TestSet)).all()")
code = code.replace("""def create_test_set(test_set: TestSetBase):
    new_test_set = TestSet(id=str(uuid.uuid4()), **test_set.model_dump(), created_at=datetime.datetime.now().isoformat())
    test_sets_db.append(new_test_set)
    return new_test_set""", """def create_test_set(test_set: TestSetBase):
    with Session(engine) as session:
        new_test_set = TestSet(id=str(uuid.uuid4()), **test_set.model_dump(), created_at=datetime.datetime.now().isoformat())
        session.add(new_test_set)
        session.commit()
        session.refresh(new_test_set)
        return new_test_set""")

code = code.replace("def get_metrics(): return metrics_db", "def get_metrics():\n    with Session(engine) as session:\n        return session.exec(select(Metric)).all()")
code = code.replace("""def create_metric(metric: MetricBase):
    new_metric = Metric(id=str(uuid.uuid4()), **metric.model_dump(), created_at=datetime.datetime.now().isoformat())
    metrics_db.append(new_metric)
    return new_metric""", """def create_metric(metric: MetricBase):
    with Session(engine) as session:
        new_metric = Metric(id=str(uuid.uuid4()), **metric.model_dump(), created_at=datetime.datetime.now().isoformat())
        session.add(new_metric)
        session.commit()
        session.refresh(new_metric)
        return new_metric""")

code = code.replace("def get_simulations(): return simulations_db", "def get_simulations():\n    with Session(engine) as session:\n        return session.exec(select(Simulation)).all()")
code = code.replace("""def create_simulation(sim: SimulationBase, background_tasks: BackgroundTasks):
    new_sim = Simulation(id=str(uuid.uuid4()), **sim.model_dump(), status="running", created_at=datetime.datetime.now().isoformat())
    simulations_db.append(new_sim)
    background_tasks.add_task(run_simulation_engine, new_sim)
    return new_sim""", """def create_simulation(sim: SimulationBase, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        new_sim = Simulation(id=str(uuid.uuid4()), **sim.model_dump(), status="running", created_at=datetime.datetime.now().isoformat())
        session.add(new_sim)
        session.commit()
        session.refresh(new_sim)
    background_tasks.add_task(run_simulation_engine, new_sim)
    return new_sim""")

code = code.replace("def get_conversations(): return conversations_db", "def get_conversations():\n    with Session(engine) as session:\n        return session.exec(select(Conversation)).all()")
code = code.replace("""def create_conversation(conv: ConversationBase, background_tasks: BackgroundTasks):
    new_conv = Conversation(id=str(uuid.uuid4()), **conv.model_dump(), created_at=datetime.datetime.now().isoformat())
    conversations_db.append(new_conv)
    background_tasks.add_task(evaluate_live_conversation, new_conv)
    return new_conv""", """def create_conversation(conv: ConversationBase, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        new_conv = Conversation(id=str(uuid.uuid4()), **conv.model_dump(), created_at=datetime.datetime.now().isoformat())
        session.add(new_conv)
        session.commit()
        session.refresh(new_conv)
    background_tasks.add_task(evaluate_live_conversation, new_conv)
    return new_conv""")

code = code.replace("def get_schedules(): return schedules_db", "def get_schedules():\n    with Session(engine) as session:\n        return session.exec(select(Schedule)).all()")
code = code.replace("""def create_schedule(sched: ScheduleBase):
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
    return new_sched""", """def create_schedule(sched: ScheduleBase):
    try:
        now = datetime.datetime.now()
        itr = croniter(sched.cron_expression, now)
        next_run = itr.get_next(datetime.datetime)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid cron expression: {e}")
        
    with Session(engine) as session:
        new_sched = Schedule(
            id=str(uuid.uuid4()), 
            **sched.model_dump(), 
            created_at=now.isoformat(),
            next_run_at=next_run.isoformat()
        )
        session.add(new_sched)
        session.commit()
        session.refresh(new_sched)
        return new_sched""")

code = code.replace("""def delete_schedule(schedule_id: str):
    global schedules_db
    schedules_db = [s for s in schedules_db if s.id != schedule_id]
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
    return new_trace""", """def upload_traces(trace: TraceBase):
    with Session(engine) as session:
        new_trace = Trace(
            id=str(uuid.uuid4()),
            **trace.model_dump(),
            created_at=datetime.datetime.now().isoformat()
        )
        session.add(new_trace)
        session.commit()
        session.refresh(new_trace)
        return new_trace""")

with open("src/backend/main.py", "w") as f:
    f.write(code)
