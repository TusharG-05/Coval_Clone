"use client";
import { useState, useEffect } from "react";
import { Activity, Plus, X } from "lucide-react";

interface Metric {
  id: string;
  name: string;
  type: string;
  criteria: string;
  created_at: string;
}

export default function MetricsPage() {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", type: "accuracy", criteria: "" });

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/metrics");
      const data = await res.json();
      setMetrics(data);
    } catch (error) {
      console.error("Failed to fetch metrics:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("http://localhost:8000/api/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setIsFormOpen(false);
        setFormData({ name: "", type: "accuracy", criteria: "" });
        fetchMetrics();
      }
    } catch (error) {
      console.error("Failed to create metric:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Activity className="h-6 w-6 text-amber-400" />
            Metrics
          </h1>
          <p className="text-gray-400 mt-1">The pass/fail criteria and measurements applied to each conversation.</p>
        </div>
        <button 
          onClick={() => setIsFormOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Metric
        </button>
      </div>

      {isFormOpen && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-white">Create New Metric</h2>
            <button onClick={() => setIsFormOpen(false)} className="text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Name</label>
              <input 
                required
                type="text" 
                className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-white outline-none focus:border-amber-500"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Type</label>
              <select 
                className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-white outline-none focus:border-amber-500"
                value={formData.type}
                onChange={(e) => setFormData({...formData, type: e.target.value})}
              >
                <option value="accuracy">Accuracy (LLM Judged)</option>
                <option value="latency">Latency</option>
                <option value="sentiment">Sentiment</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Criteria (Pass Condition)</label>
              <textarea 
                required
                rows={2}
                placeholder="e.g. Agent must respond in under 2 seconds, or Agent successfully books the ticket."
                className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-white outline-none focus:border-amber-500"
                value={formData.criteria}
                onChange={(e) => setFormData({...formData, criteria: e.target.value})}
              />
            </div>
            <button type="submit" className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium">
              Save Metric
            </button>
          </form>
        </div>
      )}

      {metrics.length === 0 && !isFormOpen ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <Activity className="w-12 h-12 text-gray-700 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-300">No metrics yet</h3>
          <p className="text-gray-500 mt-1 mb-4">Create metrics to evaluate how well your agent performed.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {metrics.map((metric) => (
            <div key={metric.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-white text-lg">{metric.name}</h3>
                <span className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded-full uppercase tracking-wider">
                  {metric.type}
                </span>
              </div>
              <p className="text-sm text-gray-400">{metric.criteria}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
