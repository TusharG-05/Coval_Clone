"use client";
import { useState, useEffect, useCallback } from "react";
import { Simulation, Conversation, MetricResult, Message } from "@/types";

type CombinedRun = (Simulation | Conversation) & { runType: string };
import { ThumbsUp, ThumbsDown, CheckCircle, XCircle, AlertCircle, FileText, CheckSquare, MessageSquare } from "lucide-react";

export default function HumanReviewPage() {
  const [runs, setRuns] = useState<CombinedRun[]>([]); // Combining simulations and conversations
  const [expandedRun, setExpandedRun] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [simRes, convRes] = await Promise.all([
        fetch("http://localhost:8000/api/simulations"),
        fetch("http://localhost:8000/api/conversations")
      ]);
      const sims = await simRes.json();
      const convs = await convRes.json();
      
      // Combine and sort by date descending
      const combined = [
        ...sims.map((s: Simulation) => ({ ...s, runType: "Simulation" })),
        ...convs.map((c: Conversation) => ({ ...c, runType: "Live Call" }))
      ].filter(r => r.results).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      setRuns(combined);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);


  const handleOverride = async (runId: string, metricId: string, passed: boolean) => {
    const reason = prompt(`Please provide reasoning for overriding to ${passed ? 'PASS' : 'FAIL'}:`);
    if (reason === null) return; // User cancelled
    
    try {
      const res = await fetch(`http://localhost:8000/api/reviews/${runId}/${metricId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passed, human_reasoning: reason }),
      });
      if (res.ok) {
        fetchData(); // Refresh data to show override
      }
    } catch (error) {
      console.error("Failed to override:", error);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <CheckSquare className="h-8 w-8 text-indigo-500" />
          Human Review
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Manually review LLM judge evaluations and override incorrect scores to improve accuracy.</p>
      </div>

      {runs.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-12 text-center shadow-sm">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4 opacity-50" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No completed runs to review</h3>
          <p className="text-gray-500 max-w-md mx-auto">Launch a simulation or upload a live conversation first.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {runs.map(run => (
            <div key={run.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden">
              <div 
                className="p-5 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/80 transition-colors"
                onClick={() => setExpandedRun(expandedRun === run.id ? null : run.id)}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${run.runType === 'Simulation' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'}`}>
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {run.runType}: {run.id.split("-")[0]}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">{new Date(run.created_at).toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {Object.values(run.results || {}).map((res: MetricResult, idx) => (
                    <div key={idx} className={`w-3 h-3 rounded-full ${res.passed ? 'bg-emerald-500' : 'bg-red-500'} ${res.human_reviewed ? 'ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-gray-900' : ''}`} title={`${res.name}: ${res.passed ? 'PASS' : 'FAIL'} ${res.human_reviewed ? '(Human Reviewed)' : ''}`} />
                  ))}
                </div>
              </div>

              {expandedRun === run.id && (
                <div className="border-t border-gray-200 dark:border-gray-800 flex flex-col md:flex-row h-[500px]">
                  
                  {/* Left: Transcript */}
                  <div className="w-full md:w-1/2 p-5 border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-800 overflow-y-auto bg-gray-50 dark:bg-gray-950/50">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2 sticky top-0 bg-gray-50 dark:bg-gray-950/50 py-2">
                      <FileText className="w-4 h-4 text-blue-500" /> 
                      Transcript
                    </h4>
                    <div className="space-y-4">
                      {run.transcript?.map((msg: Message, idx: number) => (
                        <div key={idx} className={`flex ${msg.role === 'persona' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${msg.role === 'persona' ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-tl-sm border border-gray-200 dark:border-gray-700 shadow-sm'}`}>
                            <div className="text-[10px] opacity-70 mb-1 uppercase font-semibold tracking-wider">
                              {msg.role}
                            </div>
                            {msg.text}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right: Metrics & Review */}
                  <div className="w-full md:w-1/2 p-5 overflow-y-auto">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <CheckSquare className="w-4 h-4 text-indigo-500" /> 
                      Evaluate Metrics
                    </h4>
                    
                    <div className="space-y-4">
                      {Object.values(run.results || {}).map((res: MetricResult, idx) => (
                        <div key={idx} className={`p-4 rounded-xl border ${res.passed ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/30' : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/30'}`}>
                          
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <span className="font-bold text-gray-900 dark:text-white block">{res.name}</span>
                              <div className="flex items-center gap-2 mt-1">
                                {res.passed ? (
                                  <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 rounded">
                                    <CheckCircle className="w-3 h-3" /> PASS
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1 text-xs font-bold text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/50 px-2 py-0.5 rounded">
                                    <XCircle className="w-3 h-3" /> FAIL
                                  </span>
                                )}
                                {res.human_reviewed && (
                                  <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/50 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                                    Human Overridden
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            {/* Human Review Actions */}
                            <div className="flex gap-2">
                              <button 
                                onClick={() => handleOverride(run.id, res.name, true)}
                                className={`p-2 rounded-lg transition-colors ${res.passed ? 'bg-emerald-200 text-emerald-800 dark:bg-emerald-800 dark:text-emerald-200' : 'bg-white dark:bg-gray-800 text-gray-500 hover:text-emerald-600 shadow-sm border border-gray-200 dark:border-gray-700'}`}
                                title="Force Pass"
                              >
                                <ThumbsUp className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleOverride(run.id, res.name, false)}
                                className={`p-2 rounded-lg transition-colors ${!res.passed ? 'bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200' : 'bg-white dark:bg-gray-800 text-gray-500 hover:text-red-600 shadow-sm border border-gray-200 dark:border-gray-700'}`}
                                title="Force Fail"
                              >
                                <ThumbsDown className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          
                          <div className="text-xs text-gray-600 dark:text-gray-400 bg-white/50 dark:bg-black/20 p-3 rounded-lg border border-gray-200 dark:border-gray-800/50">
                            <span className="font-semibold text-gray-900 dark:text-gray-300 block mb-1">LLM Reasoning:</span>
                            {res.reasoning}
                          </div>
                          
                          {res.human_reviewed && res.human_reasoning && (
                            <div className="mt-2 text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-100/50 dark:bg-indigo-900/30 p-3 rounded-lg border border-indigo-200 dark:border-indigo-800/50">
                              <span className="font-semibold block mb-1 flex items-center gap-1">
                                <CheckSquare className="w-3 h-3" /> Human Note:
                              </span>
                              {res.human_reasoning}
                            </div>
                          )}

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
  );
}
