"use client";
import { useState, useEffect, useCallback } from "react";
import { ListTree, Upload, Hash } from "lucide-react";
import { Trace, Simulation, TraceSpan } from "@/types";

export default function TracesPage() {
  const [traces, setTraces] = useState<Trace[]>([]);
  const [simulations, setSimulations] = useState<Simulation[]>([]);
  const [selectedRun, setSelectedRun] = useState("");
  const [traceInput, setTraceInput] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [expandedTrace, setExpandedTrace] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const simRes = await fetch("http://localhost:8000/api/simulations");
      setSimulations(await simRes.json());
      
      // Fetch traces for all simulations (in a real app, you'd fetch by run, but here we just get all for demo)
      // Since our API currently only gets traces by run_id, we'll fetch them individually for the completed sims
      const sims = await simRes.json();
      const allTraces: Trace[] = [];
      
      for (const sim of sims) {
        if (sim.status === "completed") {
          const tRes = await fetch(`http://localhost:8000/api/traces/${sim.id}`);
          if (tRes.ok) {
            const tData = await tRes.json();
            allTraces.push(...tData);
          }
        }
      }
      setTraces(allTraces.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);


  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRun) return alert("Select a Run ID first");
    if (!traceInput.trim()) return alert("Enter trace JSON");
    
    try {
      let spans = [];
      try {
        spans = JSON.parse(traceInput);
        if (!Array.isArray(spans)) throw new Error("Must be a JSON array");
      } catch (err) {
        console.error(err);
        return alert("Invalid JSON format. Must be an array of span objects.");
      }
      
      setIsUploading(true);
      const res = await fetch("http://localhost:8000/api/traces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ run_id: selectedRun, spans }),
      });
      
      if (res.ok) {
        setTraceInput("");
        fetchData();
      }
    } catch (error) {
      console.error("Failed to upload trace:", error);
    } finally {
      setIsUploading(false);
    }
  };

  // Removed unused getDurationWidth

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <ListTree className="h-8 w-8 text-teal-500" />
            Traces
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">View OpenTelemetry-compatible traces attached to your simulations.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Upload Form */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm rounded-2xl p-6 h-fit lg:col-span-1">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Upload className="w-5 h-5 text-teal-500" />
            Upload Trace (Mock SDK)
          </h2>
          <p className="text-sm text-gray-500 mb-6">In production, your agent&apos;s SDK sends these automatically. Here you can mock them.</p>
          
          <form className="space-y-4" onSubmit={handleUpload}>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Simulation Run</label>
              <select 
                required
                className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-3 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-500"
                value={selectedRun}
                onChange={e => setSelectedRun(e.target.value)}
              >
                <option value="">Select a run...</option>
                {simulations.filter(s => s.status === 'completed').map(sim => (
                  <option key={sim.id} value={sim.id}>Run: {sim.id.split("-")[0]} ({new Date(sim.created_at).toLocaleString()})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Span Data (JSON Array)</label>
              <textarea 
                required
                rows={10}
                placeholder={`[\n  { "name": "LLM Generate", "duration_ms": 1200, "tokens": 402 },\n  { "name": "DB Lookup", "duration_ms": 150 }\n]`}
                className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-3 text-xs font-mono text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-500"
                value={traceInput}
                onChange={e => setTraceInput(e.target.value)}
              />
            </div>

            <button 
              type="submit" 
              disabled={isUploading}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
            >
              Upload Trace
            </button>
          </form>
        </div>

        {/* Trace List */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm rounded-2xl p-6 lg:col-span-2">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Trace Explorer</h2>
          
          {traces.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <ListTree className="w-12 h-12 mb-4 opacity-30 mx-auto" />
              <p>No traces received yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {traces.map(trace => (
                <div key={trace.id} className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                  <div 
                    className="p-4 bg-gray-50 dark:bg-gray-950 flex items-center justify-between cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-900/80 transition-colors"
                    onClick={() => setExpandedTrace(expandedTrace === trace.id ? null : trace.id)}
                  >
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white text-sm flex items-center gap-2">
                        <Hash className="w-4 h-4 text-teal-500" />
                        Run: {trace.run_id.split("-")[0]}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">{new Date(trace.created_at).toLocaleString()}</p>
                    </div>
                    <span className="text-xs bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300 px-3 py-1 rounded-full font-semibold">
                      {trace.spans.length} Spans
                    </span>
                  </div>

                  {expandedTrace === trace.id && (
                    <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-3">
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Waterfall View</div>
                      
                      {trace.spans.map((span: TraceSpan, idx: number) => (
                        <div key={idx} className="bg-gray-50 dark:bg-gray-950/50 border border-gray-100 dark:border-gray-800/50 rounded-lg p-3">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">{span.name || "Unnamed Span"}</span>
                            {span.duration_ms && <span className="text-xs text-teal-600 dark:text-teal-400 font-mono">{span.duration_ms}ms</span>}
                          </div>
                          
                          {/* Fake progress bar to represent trace length */}
                          <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-1.5 mb-3">
                            <div className="bg-teal-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, (span.duration_ms || 100) / 20)}%` }}></div>
                          </div>
                          
                          {/* Span Attributes */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {Object.entries(span).filter(([k]) => k !== 'name' && k !== 'duration_ms').map(([k, v]) => (
                              <div key={k} className="text-xs bg-white dark:bg-gray-900 p-1.5 rounded border border-gray-200 dark:border-gray-800 truncate">
                                <span className="text-gray-500 block mb-0.5">{k}</span>
                                <span className="text-gray-900 dark:text-gray-300 font-mono">{String(v)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
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
