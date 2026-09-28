"use client";
import { useState, useEffect, useCallback } from "react";
import { MessageSquare, Upload, Activity } from "lucide-react";
import { Metric, Conversation, MetricResult } from "@/types";

export default function ConversationsPage() {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  
  const [isUploading, setIsUploading] = useState(false);
  const [formData, setFormData] = useState({
    transcriptText: "",
    metric_ids: [] as string[]
  });
  
  const [expandedConv, setExpandedConv] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const mRes = await fetch("http://localhost:8000/api/metrics");
      setMetrics(await mRes.json());
      fetchConversations();
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchConversations, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);


  const fetchConversations = async () => {
    try {
      const cRes = await fetch("http://localhost:8000/api/conversations");
      setConversations(await cRes.json());
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
    if (!formData.transcriptText.trim()) return alert("Please enter a transcript");
    
    // Naive parsing of text transcript assuming "User: ..." and "Agent: ..."
    const lines = formData.transcriptText.split('\n');
    const parsedTranscript = lines
      .filter(l => l.trim())
      .map(line => {
        const isUser = line.toLowerCase().startsWith('user:') || line.toLowerCase().startsWith('persona:');
        return {
          role: isUser ? "persona" : "agent",
          text: line.replace(/^(user|agent|persona):\s*/i, '').trim()
        };
      });

    if (parsedTranscript.length === 0) return alert("Could not parse transcript. Make sure lines start with 'User:' or 'Agent:'");

    setIsUploading(true);
    try {
      const res = await fetch("http://localhost:8000/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: parsedTranscript,
          metric_ids: formData.metric_ids
        }),
      });
      if (res.ok) {
        setFormData({ transcriptText: "", metric_ids: [] });
        fetchConversations();
      }
    } catch (error) {
      console.error("Failed to upload conversation:", error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <MessageSquare className="h-8 w-8 text-purple-500" />
          Observe (Live Conversations)
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Upload transcripts from your real production calls and automatically evaluate them.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm rounded-2xl p-6 h-fit">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
            <Upload className="w-5 h-5 text-purple-500" />
            Upload Transcript
          </h2>
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Raw Transcript</label>
              <textarea 
                required
                rows={8}
                placeholder="User: Hi I need a refund&#10;Agent: I can help with that!"
                className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-3 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                value={formData.transcriptText}
                onChange={e => setFormData({...formData, transcriptText: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Metrics to Evaluate</label>
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
                        className="w-4 h-4 rounded border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-purple-600 focus:ring-purple-600" 
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

            <button 
              type="submit" 
              disabled={isUploading}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
            >
              {isUploading ? "Uploading & Evaluating..." : "Upload & Evaluate"}
            </button>
          </form>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Recent Uploads</h2>
          
          {conversations.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <MessageSquare className="w-12 h-12 mb-4 opacity-50 mx-auto" />
              <p>No live conversations uploaded yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {conversations.slice().reverse().map(conv => (
                <div key={conv.id} className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                  <div 
                    className="p-4 bg-gray-50 dark:bg-gray-950 flex items-center justify-between cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-900/80 transition-colors"
                    onClick={() => setExpandedConv(expandedConv === conv.id ? null : conv.id)}
                  >
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white text-sm">Call: {conv.id.split("-")[0]}</p>
                      <p className="text-xs text-gray-500">{new Date(conv.created_at).toLocaleString()}</p>
                    </div>
                    {conv.results ? (
                      <span className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 px-2 py-1 rounded-full font-semibold">Evaluated</span>
                    ) : (
                      <span className="text-xs bg-gray-200 dark:bg-gray-800 text-gray-500 px-2 py-1 rounded-full animate-pulse">Evaluating...</span>
                    )}
                  </div>

                  {expandedConv === conv.id && conv.results && (
                    <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-4">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <Activity className="w-4 h-4 text-amber-500" /> Metric Results
                      </h4>
                      <div className="space-y-2">
                        {Object.values(conv.results).map((res: MetricResult, idx) => (
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
