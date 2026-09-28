"use client";
import { useState, useEffect, useCallback } from "react";
import { Schedule, Agent, Persona, TestSet, Metric } from "@/types";
import { Calendar, Plus, X, Clock, PlayCircle, Trash2 } from "lucide-react";

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const [agents, setAgents] = useState<Agent[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [testSets, setTestSets] = useState<TestSet[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);

  const [formData, setFormData] = useState({
    name: "",
    cron_expression: "0 0 * * *",
    agent_id: "",
    persona_id: "",
    test_set_id: "",
    metric_ids: [] as string[]
  });

  const fetchData = useCallback(async () => {
    try {
      const [aRes, pRes, tsRes, mRes] = await Promise.all([
        fetch("http://localhost:8000/api/agents"),
        fetch("http://localhost:8000/api/personas"),
        fetch("http://localhost:8000/api/test-sets"),
        fetch("http://localhost:8000/api/metrics")
      ]);
      setAgents(await aRes.json());
      setPersonas(await pRes.json());
      setTestSets(await tsRes.json());
      setMetrics(await mRes.json());
      fetchSchedules();
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchSchedules, 10000); // refresh every 10s
    return () => clearInterval(interval);
  }, [fetchData]);


  const fetchSchedules = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/schedules");
      setSchedules(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const handleMetricToggle = (id: string) => {
    if (formData.metric_ids.includes(id)) {
      setFormData({...formData, metric_ids: formData.metric_ids.filter(mId => mId !== id)});
    } else {
      setFormData({...formData, metric_ids: [...formData.metric_ids, id]});
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("http://localhost:8000/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setIsFormOpen(false);
        setFormData({ ...formData, name: "", cron_expression: "0 0 * * *" });
        fetchSchedules();
      } else {
        const err = await res.json();
        alert(err.detail);
      }
    } catch (error) {
      console.error("Failed to create schedule:", error);
    }
  };

  const deleteSchedule = async (id: string) => {
    try {
      await fetch(`http://localhost:8000/api/schedules/${id}`, { method: "DELETE" });
      fetchSchedules();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Calendar className="h-6 w-6 text-pink-500" />
            Scheduled Runs
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Automatically run simulations on a recurring schedule.</p>
        </div>
        <button 
          onClick={() => setIsFormOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-pink-600 hover:bg-pink-700 dark:hover:bg-pink-500 text-white rounded-lg font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Schedule
        </button>
      </div>

      {isFormOpen && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm rounded-xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Create New Schedule</h2>
            <button onClick={() => setIsFormOpen(false)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Schedule Name</label>
                <input 
                  required
                  type="text" 
                  className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-2.5 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-pink-500/50"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cron Expression</label>
                <input 
                  required
                  type="text" 
                  placeholder="*/5 * * * *"
                  className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-2.5 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-pink-500/50 font-mono"
                  value={formData.cron_expression}
                  onChange={(e) => setFormData({...formData, cron_expression: e.target.value})}
                />
                <p className="text-xs text-gray-500 mt-1">e.g. &quot;0 0 * * *&quot; for daily at midnight, &quot;*/2 * * * *&quot; for every 2 minutes.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-gray-200 dark:border-gray-800 pt-4">
               <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Agent</label>
                <select required className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-2 text-sm text-gray-900 dark:text-white" value={formData.agent_id} onChange={e => setFormData({...formData, agent_id: e.target.value})}>
                  <option value="">Choose...</option>
                  {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Persona</label>
                <select required className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-2 text-sm text-gray-900 dark:text-white" value={formData.persona_id} onChange={e => setFormData({...formData, persona_id: e.target.value})}>
                  <option value="">Choose...</option>
                  {personas.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Test Set</label>
                <select required className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-2 text-sm text-gray-900 dark:text-white" value={formData.test_set_id} onChange={e => setFormData({...formData, test_set_id: e.target.value})}>
                  <option value="">Choose...</option>
                  {testSets.map(ts => <option key={ts.id} value={ts.id}>{ts.name}</option>)}
                </select>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Metrics to evaluate</label>
              <div className="flex gap-2 flex-wrap">
                {metrics.map(m => (
                  <label key={m.id} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="rounded text-pink-600 focus:ring-pink-600" 
                      checked={formData.metric_ids.includes(m.id)}
                      onChange={() => handleMetricToggle(m.id)}
                    />
                    <span className="text-sm text-gray-900 dark:text-white">{m.name}</span>
                  </label>
                ))}
              </div>
            </div>
            
            <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-800">
              <button type="submit" className="px-6 py-2.5 bg-pink-600 hover:bg-pink-700 dark:hover:bg-pink-500 text-white rounded-lg font-medium transition-colors">
                Save Schedule
              </button>
            </div>
          </form>
        </div>
      )}

      {schedules.length === 0 && !isFormOpen ? (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-12 text-center shadow-sm">
          <div className="w-16 h-16 bg-pink-100 dark:bg-pink-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-pink-600 dark:text-pink-400" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No schedules set</h3>
          <p className="text-gray-500 max-w-md mx-auto mb-6">Create a cron job to automatically run simulations on a recurring basis.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {schedules.map((sched) => (
            <div key={sched.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm hover:border-pink-200 dark:hover:border-gray-700 transition-colors">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-lg">{sched.name}</h3>
                  <p className="text-sm font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded inline-block mt-2 text-gray-700 dark:text-gray-300">
                    cron: {sched.cron_expression}
                  </p>
                </div>
                <button onClick={() => deleteSchedule(sched.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
              
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <PlayCircle className="w-4 h-4 text-emerald-500" />
                  Next run:
                </div>
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {new Date(sched.next_run_at).toLocaleString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
