"use client";
import { useState, useEffect, useCallback } from "react";
import { Agent, Persona, TestSet, Metric, Simulation, MetricResult, Message } from "@/types";
import { Play, RotateCw, CheckCircle, Clock, XCircle, FileText, Activity, Settings2, Plus, X } from "lucide-react";

export default function SimulatePage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [testSets, setTestSets] = useState<TestSet[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);

  const [formData, setFormData] = useState({
    agent_id: "",
    persona_id: "",
    test_set_id: "",
    metric_ids: [] as string[],
    mutations: {} as Record<string, string>
  });

  const [simulations, setSimulations] = useState<Simulation[]>([]);
  const [expandedSim, setExpandedSim] = useState<string | null>(null);

  const [newMutationKey, setNewMutationKey] = useState("");
  const [newMutationValue, setNewMutationValue] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [aRes, pRes, tsRes, mRes] = await Promise.all([
        fetch("http://localhost:8000/api/agents"),
        fetch("http://localhost:8000/api/personas"),
        fetch("http://localhost:8000/api/test-sets"),
        fetch("http://localhost:8000/api/metrics")
      ]);
      const [aData, pData, tsData, mData] = await Promise.all([
        aRes.json(),
        pRes.json(),
        tsRes.json(),
        mRes.json()
      ]);
      setAgents(aData);
      setPersonas(pData);
      setTestSets(tsData);
      setMetrics(mData);
      setFormData(prev => ({
        ...prev,
        metric_ids: prev.metric_ids.length > 0 ? prev.metric_ids : mData.map((m: any) => m.id)
      }));
      fetchSimulations();
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Poll for simulation updates every 3 seconds
    const interval = setInterval(fetchSimulations, 3000);
    return () => clearInterval(interval);
  }, [fetchData]);


  const fetchSimulations = async () => {
    try {
      const simRes = await fetch("http://localhost:8000/api/simulations");
      setSimulations(await simRes.json());
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

  const addMutation = () => {
    if (!newMutationKey) return;
    setFormData({
      ...formData,
      mutations: { ...formData.mutations, [newMutationKey]: newMutationValue }
    });
    setNewMutationKey("");
    setNewMutationValue("");
  };

  const removeMutation = (key: string) => {
    const newMutations = { ...formData.mutations };
    delete newMutations[key];
    setFormData({ ...formData, mutations: newMutations });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.agent_id || !formData.persona_id || !formData.test_set_id) {
      alert("Please select Agent, Persona, and Test Set");
      return;
    }
    
    try {
      const res = await fetch("http://localhost:8000/api/simulations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          metric_ids: formData.metric_ids.length > 0 ? formData.metric_ids : metrics.map(m => m.id),
          mutations: Object.keys(formData.mutations).length > 0 ? formData.mutations : undefined
        }),
      });
      if (res.ok) {
        setFormData({ agent_id: "", persona_id: "", test_set_id: "", metric_ids: [], mutations: {} });
        fetchSimulations();
      }
    } catch (error) {
      console.error("Failed to launch simulation:", error);
    }
  };

  const getStatusIcon = (status: string) => {
    if (status === "running") return <RotateCw className="w-5 h-5 text-blue-500 animate-spin" />;
    if (status === "completed") return <CheckCircle className="w-5 h-5 text-emerald-500" />;
    return <XCircle className="w-5 h-5 text-red-500" />;
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <Play className="h-8 w-8 text-blue-600 dark:text-blue-500" />
          Simulations
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Configure and run a simulated conversation to test your agent.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Launch Form */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm rounded-2xl p-6 h-fit">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">New Run</h2>
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Agent</label>
                <select 
                  className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.agent_id}
                  onChange={e => setFormData({...formData, agent_id: e.target.value})}
                >
                  <option value="">Choose an agent...</option>
                  {agents.map(a => <option key={a.id} value={a.id}>{a.name} ({a.connection_type})</option>)}
                </select>
              </div>

              {/* Agent Mutations Section */}
              {formData.agent_id && (
                <div className="pl-4 border-l-2 border-blue-500/30 space-y-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <Settings2 className="w-4 h-4 text-blue-500" />
                    Agent Mutations (Overrides)
                  </label>
                  
                  {Object.entries(formData.mutations).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-950 p-2 rounded-lg border border-gray-200 dark:border-gray-800">
                      <span className="text-xs font-mono text-gray-500 bg-gray-200 dark:bg-gray-800 px-2 py-1 rounded">{key}</span>
                      <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 truncate">{value}</span>
                      <button type="button" onClick={() => removeMutation(key)} className="text-gray-400 hover:text-red-500">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  <div className="flex gap-2">
                    <input 
                      placeholder="Key (e.g. system_prompt)"
                      className="w-1/3 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-2 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500"
                      value={newMutationKey}
                      onChange={e => setNewMutationKey(e.target.value)}
                    />
                    <input 
                      placeholder="New value"
                      className="flex-1 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-2 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500"
                      value={newMutationValue}
                      onChange={e => setNewMutationValue(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addMutation())}
                    />
                    <button 
                      type="button" 
                      onClick={addMutation}
                      disabled={!newMutationKey}
                      className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg disabled:opacity-50"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Persona</label>
                <select 
                  className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.persona_id}
                  onChange={e => setFormData({...formData, persona_id: e.target.value})}
                >
                  <option value="">Choose a persona...</option>
                  {personas.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Test Set</label>
                <select 
                  className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.test_set_id}
                  onChange={e => setFormData({...formData, test_set_id: e.target.value})}
                >
                  <option value="">Choose a test set...</option>
                  {testSets.map(ts => <option key={ts.id} value={ts.id}>{ts.name}</option>)}
                </select>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Metrics to track</label>
                <button 
                  type="button" 
                  onClick={() => setFormData(p => ({ ...p, metric_ids: p.metric_ids.length === metrics.length ? [] : metrics.map(m => m.id) }))}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {formData.metric_ids.length === metrics.length ? "Deselect All" : "Select All"}
                </button>
              </div>
                {metrics.length === 0 ? (
                  <div className="bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-3 text-gray-500 text-sm">
                    No metrics available. Please create metrics first.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                    {metrics.map(m => (
                      <label key={m.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg cursor-pointer hover:border-gray-300 dark:hover:border-gray-700">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-blue-600 focus:ring-blue-600" 
                          checked={formData.metric_ids.includes(m.id)}
                          onChange={() => handleMetricToggle(m.id)}
                        />
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{m.name}</p>
                          <p className="text-xs text-gray-500">{m.type}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
              <button type="submit" className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 hover:bg-blue-700 dark:hover:bg-blue-500 text-white rounded-xl font-medium transition-all shadow-lg shadow-blue-500/20 text-lg">
                <Play className="w-6 h-6" />
                Launch Evaluation
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Run History & Reports */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm rounded-2xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Run History</h2>
            <button onClick={fetchSimulations} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
              Refresh
            </button>
          </div>
          
          {simulations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Clock className="w-12 h-12 mb-4 opacity-50" />
              <p>No simulations run yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {simulations.slice().reverse().map(sim => (
                <div key={sim.id} className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                  <div 
                    className="p-4 bg-gray-50 dark:bg-gray-950 flex items-center justify-between cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-900/80 transition-colors"
                    onClick={() => setExpandedSim(expandedSim === sim.id ? null : sim.id)}
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(sim.status)}
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white text-sm">
                          Run: {sim.id.split("-")[0]}
                          {sim.mutations && Object.keys(sim.mutations).length > 0 && (
                            <span className="ml-2 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 px-1.5 py-0.5 rounded">Mutated</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500">{new Date(sim.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs rounded-full uppercase tracking-wider font-semibold">
                      {sim.status}
                    </span>
                  </div>

                  {/* Expanded Report View */}
                  {expandedSim === sim.id && sim.status === "completed" && (
                    <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-6">
                      
                      {/* Metric Results */}
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                          <Activity className="w-4 h-4 text-amber-500" /> 
                          Metric Results
                        </h4>
                        {sim.results && Object.keys(sim.results).length > 0 ? (
                          <div className="space-y-2">
                            {Object.values(sim.results).map((res: MetricResult, idx) => (
                              <div key={idx} className={`p-3 rounded-lg border ${res.passed ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50' : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/50'}`}>
                                <div className="flex justify-between items-center mb-1">
                                  <span className={`font-medium text-sm ${res.passed ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                                    {res.name}
                                  </span>
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${res.passed ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'}`}>
                                    {res.passed ? "PASS" : "FAIL"}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-600 dark:text-gray-400">{res.reasoning}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">No metrics were evaluated.</p>
                        )}
                      </div>

                      {/* Transcript */}
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-500" /> 
                          Conversation Transcript
                        </h4>
                        <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                          {sim.transcript?.map((msg: Message, idx: number) => (
                            <div key={idx} className={`flex ${msg.role === 'persona' ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${msg.role === 'persona' ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-tl-sm'}`}>
                                <div className="text-[10px] opacity-70 mb-1 uppercase font-semibold tracking-wider">
                                  {msg.role}
                                </div>
                                {msg.text}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
