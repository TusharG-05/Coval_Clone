"use client";
import { useState, useEffect, useCallback } from "react";
import { MessageSquare, Upload, Activity, CheckCircle, XCircle, Clock } from "lucide-react";
import { Metric, Conversation, MetricResult } from "@/types";

function parseTranscriptText(rawText: string) {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const result: { role: string; text: string; time?: string }[] = [];
  
  let currentRole: string | null = null;
  let currentText = "";
  let currentTime: string | undefined = undefined;

  for (const line of lines) {
    // Check if line is purely a role marker (e.g. "agent", "persona", "user", "caller", "candidate")
    const pureRoleMatch = line.match(/^(agent|persona|user|caller|candidate|assistant)$/i);
    if (pureRoleMatch) {
      if (currentRole && currentText.trim()) {
        result.push({ role: currentRole, text: currentText.trim(), time: currentTime });
      }
      const roleStr = pureRoleMatch[1].toLowerCase();
      currentRole = (roleStr === "persona" || roleStr === "user" || roleStr === "caller" || roleStr === "candidate") ? "persona" : "agent";
      currentText = "";
      currentTime = undefined;
      continue;
    }

    // Check inline role marker like "Agent: ...", "Persona: ...", "[00:12] Agent: ..."
    const inlineMatch = line.match(/^(?:\[([0-9:]+)\]\s*)?(agent|persona|user|caller|candidate|assistant):\s*(.+)$/i);
    if (inlineMatch) {
      if (currentRole && currentText.trim()) {
        result.push({ role: currentRole, text: currentText.trim(), time: currentTime });
      }
      currentTime = inlineMatch[1];
      const roleStr = inlineMatch[2].toLowerCase();
      currentRole = (roleStr === "persona" || roleStr === "user" || roleStr === "caller" || roleStr === "candidate") ? "persona" : "agent";
      currentText = inlineMatch[3];
      continue;
    }

    // Otherwise, line is part of current utterance
    if (currentRole) {
      currentText = currentText ? `${currentText} ${line}` : line;
    } else {
      // Default first role to agent if not specified
      currentRole = "agent";
      currentText = line;
    }
  }

  if (currentRole && currentText.trim()) {
    result.push({ role: currentRole, text: currentText.trim(), time: currentTime });
  }

  // Assign timestamps if missing
  const TIMESTAMPS = ["00:04", "00:18", "01:05", "01:42", "02:30", "03:15", "03:26", "04:10", "04:22", "04:50"];
  result.forEach((item, idx) => {
    if (!item.time) {
      item.time = TIMESTAMPS[idx] || ('0' + Math.floor(idx / 2) + ':20');
    }
  });

  return result;
}

export default function ConversationsPage() {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  
  const [isUploading, setIsUploading] = useState(false);
  const [formData, setFormData] = useState({
    transcriptText: "",
    metric_ids: [] as string[]
  });
  
  const [expandedConv, setExpandedConv] = useState<string | null>(null);

  const fetchConversations = async () => {
    try {
      const cRes = await fetch("http://localhost:8000/api/conversations");
      if (cRes.ok) {
        setConversations(await cRes.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchData = useCallback(async () => {
    try {
      const mRes = await fetch("http://localhost:8000/api/metrics");
      if (mRes.ok) {
        const mData: Metric[] = await mRes.json();
        setMetrics(mData);
        // Pre-select all metrics by default
        setFormData(prev => ({
          ...prev,
          metric_ids: prev.metric_ids.length > 0 ? prev.metric_ids : mData.map(m => m.id)
        }));
      }
      fetchConversations();
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchConversations, 2500);
    return () => clearInterval(interval);
  }, [fetchData]);

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
    
    const parsedTranscript = parseTranscriptText(formData.transcriptText);

    if (parsedTranscript.length === 0) {
      return alert("Could not parse transcript. Please ensure there is dialogue between Agent and Caller/Persona.");
    }

    const metricIdsToUse = formData.metric_ids.length > 0 
      ? formData.metric_ids 
      : metrics.map(m => m.id);

    setIsUploading(true);
    try {
      const res = await fetch("http://localhost:8000/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: parsedTranscript,
          metric_ids: metricIdsToUse
        }),
      });
      if (res.ok) {
        setFormData(prev => ({ ...prev, transcriptText: "" }));
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
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Upload transcripts from your production or simulated calls and run live AI evaluations against your metrics.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Upload Form */}
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
                rows={10}
                placeholder={"agent\nThank you for calling Maica HR. How can I help you today?\npersona\nHi, this is Samantha. I'm calling about the Senior Node developer role..."}
                className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-3 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                value={formData.transcriptText}
                onChange={e => setFormData({...formData, transcriptText: e.target.value})}
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Metrics to Evaluate</label>
                <button 
                  type="button" 
                  onClick={() => setFormData(p => ({ ...p, metric_ids: p.metric_ids.length === metrics.length ? [] : metrics.map(m => m.id) }))}
                  className="text-xs text-purple-600 dark:text-purple-400 hover:underline"
                >
                  {formData.metric_ids.length === metrics.length ? "Deselect All" : "Select All"}
                </button>
              </div>
              {metrics.length === 0 ? (
                <div className="bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-3 text-gray-500 text-sm">
                  Loading metrics...
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

        {/* Uploads List */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Recent Uploads</h2>
          
          {conversations.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <MessageSquare className="w-12 h-12 mb-4 opacity-50 mx-auto" />
              <p>No live conversations uploaded yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {conversations.map(conv => (
                <div key={conv.id} className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                  <div 
                    className="p-4 bg-gray-50 dark:bg-gray-950 flex items-center justify-between cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-900/80 transition-colors"
                    onClick={() => setExpandedConv(expandedConv === conv.id ? null : conv.id)}
                  >
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white text-sm">Call: {conv.id.slice(0, 8)}</p>
                      <p className="text-xs text-gray-500">{new Date(conv.created_at).toLocaleString()}</p>
                    </div>
                    {conv.results && Object.keys(conv.results).length > 0 ? (
                      <span className="text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 px-2.5 py-1 rounded-full font-semibold flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Evaluated ({Object.keys(conv.results).length} Metrics)
                      </span>
                    ) : (
                      <span className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 px-2.5 py-1 rounded-full font-semibold animate-pulse">
                        Evaluating via Groq...
                      </span>
                    )}
                  </div>

                  {expandedConv === conv.id && (
                    <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-4">
                      {/* Metric Results */}
                      {conv.results && Object.keys(conv.results).length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
                            <Activity className="w-4 h-4 text-purple-500" /> AI Judge Scorecards
                          </h4>
                          <div className="space-y-2">
                            {Object.values(conv.results).map((res: MetricResult, idx) => (
                              <div key={idx} className={`p-3 rounded-lg border ${res.passed ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50' : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/50'}`}>
                                <div className="flex justify-between items-center mb-1">
                                  <span className="font-semibold text-xs text-gray-900 dark:text-white">{res.name}</span>
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${res.passed ? 'bg-emerald-200 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300' : 'bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-300'}`}>
                                    {res.passed ? 'PASS' : 'FAIL'} ({Math.round(res.score * 100)}%)
                                  </span>
                                </div>
                                <p className="text-xs text-gray-600 dark:text-gray-400">{res.reasoning}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Transcript */}
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Transcript ({conv.transcript.length} turns)</h4>
                        <div className="space-y-2 bg-gray-50 dark:bg-gray-950 p-3 rounded-lg max-h-60 overflow-y-auto font-mono text-xs">
                          {conv.transcript.map((msg, idx) => (
                            <div key={idx} className="flex gap-2">
                              <span className="text-gray-400">[{msg.time || "00:00"}]</span>
                              <span className={`font-semibold ${msg.role === 'agent' ? 'text-blue-500' : 'text-purple-500'}`}>
                                {msg.role.toUpperCase()}:
                              </span>
                              <span className="text-gray-800 dark:text-gray-200">{msg.text}</span>
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
