with open("backend/src/backend/main.py", "r") as f:
    code = f.read()

# Fix undefined name `session` in get_run_audio
code = code.replace("""    if not os.path.exists(audio_path):
        sim = session.get(Simulation, run_id)
        if sim and sim.transcript:
            await generate_call_audio(run_id, sim.transcript)""", """    if not os.path.exists(audio_path):
        with Session(engine) as session:
            sim = session.get(Simulation, run_id)
            if sim and sim.transcript:
                await generate_call_audio(run_id, sim.transcript)""")

# Fix undefined name schedules_db in create_schedule
code = code.replace("""    new_schedule = Schedule(
        id=str(uuid.uuid4()),
        **sched.model_dump(),
        created_at=now.isoformat(),
        next_run_at=next_run
    )
    schedules_db.append(new_schedule)
    return new_schedule""", """    with Session(engine) as session:
        new_schedule = Schedule(
            id=str(uuid.uuid4()),
            **sched.model_dump(),
            created_at=now.isoformat(),
            next_run_at=next_run
        )
        session.add(new_schedule)
        session.commit()
        session.refresh(new_schedule)
        return new_schedule""")

# Fix traces_db in upload_traces
code = code.replace("""    new_trace = Trace(
        id=str(uuid.uuid4()),
        **trace.model_dump(),
        created_at=datetime.datetime.now(ZoneInfo('Asia/Kolkata')).isoformat()
    )
    traces_db.append(new_trace)
    return new_trace""", """    with Session(engine) as session:
        new_trace = Trace(
            id=str(uuid.uuid4()),
            **trace.model_dump(),
            created_at=datetime.datetime.now(ZoneInfo('Asia/Kolkata')).isoformat()
        )
        session.add(new_trace)
        session.commit()
        session.refresh(new_trace)
        return new_trace""")

# Fix override_metric_review
code = code.replace("""@app.post("/api/reviews/{run_id}/{metric_id}")
def override_metric_review(run_id: str, metric_id: str, override: ReviewOverride):
    run = session.get(Simulation, run_id)
    if not run:
        run = next((c for c in conversations_db if c.id == run_id), None)
    if not run or not run.results or metric_id not in run.results:
        raise HTTPException(status_code=404, detail="Run or Metric not found")
        
    run.results[metric_id]["passed"] = override.passed
    run.results[metric_id]["score"] = 1.0 if override.passed else 0.0
    run.results[metric_id]["human_reasoning"] = override.human_reasoning
    run.results[metric_id]["human_reviewed"] = True
    save_persistent_store()
    return {"status": "ok", "new_result": run.results[metric_id]}""", """@app.post("/api/reviews/{run_id}/{metric_id}")
def override_metric_review(run_id: str, metric_id: str, override: ReviewOverride):
    with Session(engine) as session:
        run = session.get(Simulation, run_id)
        if not run:
            run = session.get(Conversation, run_id)
        if not run or not run.results or metric_id not in run.results:
            raise HTTPException(status_code=404, detail="Run or Metric not found")
            
        run.results[metric_id]["passed"] = override.passed
        run.results[metric_id]["score"] = 1.0 if override.passed else 0.0
        run.results[metric_id]["human_reasoning"] = override.human_reasoning
        run.results[metric_id]["human_reviewed"] = True
        
        session.add(run)
        session.commit()
        return {"status": "ok", "new_result": run.results[metric_id]}""")

# Fix get_stats
code = code.replace("""@app.get("/api/stats")
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
        "total_evaluations": total_sims + total_convs,
        "pass_rate": round(pass_rate, 1),
        "human_reviews": human_reviews
    }""", """@app.get("/api/stats")
def get_stats():
    with Session(engine) as session:
        simulations = session.exec(select(Simulation)).all()
        conversations = session.exec(select(Conversation)).all()
        
        total_sims = len(simulations)
        total_convs = len(conversations)
        
        passed_metrics = 0
        total_metrics = 0
        human_reviews = 0
        
        for sim in simulations:
            if sim.results and "error" not in sim.results:
                for res in sim.results.values():
                    total_metrics += 1
                    if res.get("passed"): passed_metrics += 1
                    if res.get("human_reviewed"): human_reviews += 1
                    
        for conv in conversations:
            if conv.results:
                for res in conv.results.values():
                    total_metrics += 1
                    if res.get("passed"): passed_metrics += 1
                    if res.get("human_reviewed"): human_reviews += 1
                    
        pass_rate = (passed_metrics / total_metrics * 100) if total_metrics > 0 else 0
        
        return {
            "total_evaluations": total_sims + total_convs,
            "pass_rate": round(pass_rate, 1),
            "human_reviews": human_reviews
        }""")

# Fix live_call_end
code = code.replace("""@app.post("/api/live-call/end")
async def live_call_end(req: LiveCallEndRequest):
    agent = next((a for a in agents_db if a.id == req.agent_id), None)
    test_set = next((ts for ts in test_sets_db if ts.id == req.test_set_id), None)
    
    metrics = [m for m in metrics_db if m.id in req.metric_ids]""", """@app.post("/api/live-call/end")
async def live_call_end(req: LiveCallEndRequest):
    with Session(engine) as session:
        agent = session.get(Agent, req.agent_id)
        test_set = session.get(TestSet, req.test_set_id)
        metrics = session.exec(select(Metric).where(Metric.id.in_(req.metric_ids))).all()""")

code = code.replace("""    simulations_db.insert(0, new_sim)
    save_persistent_store()
    
    return {"status": "ok", "simulation_id": sim_id}""", """    with Session(engine) as session:
        session.add(new_sim)
        session.commit()
    
    return {"status": "ok", "simulation_id": sim_id}""")

# Fix blind exceptions
code = code.replace("except Exception:\n        pass", "except Exception as e:\n        print(f'Error: {e}')")

with open("backend/src/backend/main.py", "w") as f:
    f.write(code)
