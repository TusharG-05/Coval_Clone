"use client";
import { useState, useEffect } from "react";
import { Users, Plus, X } from "lucide-react";

interface Persona {
  id: string;
  name: string;
  background: string;
  tone: string;
  created_at: string;
}

export default function PersonasPage() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", background: "", tone: "neutral" });

  useEffect(() => {
    fetchPersonas();
  }, []);

  const fetchPersonas = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/personas");
      const data = await res.json();
      setPersonas(data);
    } catch (error) {
      console.error("Failed to fetch personas:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("http://localhost:8000/api/personas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setIsFormOpen(false);
        setFormData({ name: "", background: "", tone: "neutral" });
        fetchPersonas();
      }
    } catch (error) {
      console.error("Failed to create persona:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="h-6 w-6 text-purple-400" />
            Personas
          </h1>
          <p className="text-gray-400 mt-1">The simulated users who will talk to your agent.</p>
        </div>
        <button 
          onClick={() => setIsFormOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Persona
        </button>
      </div>

      {isFormOpen && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-white">Create New Persona</h2>
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
                className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-white outline-none focus:border-purple-500"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Tone</label>
              <select 
                className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-white outline-none focus:border-purple-500"
                value={formData.tone}
                onChange={(e) => setFormData({...formData, tone: e.target.value})}
              >
                <option value="neutral">Neutral</option>
                <option value="angry">Angry</option>
                <option value="friendly">Friendly</option>
                <option value="confused">Confused</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Background / Persona Description</label>
              <textarea 
                required
                rows={3}
                placeholder="e.g. A 40 year old customer calling about a delayed flight..."
                className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-white outline-none focus:border-purple-500"
                value={formData.background}
                onChange={(e) => setFormData({...formData, background: e.target.value})}
              />
            </div>
            <button type="submit" className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium">
              Save Persona
            </button>
          </form>
        </div>
      )}

      {personas.length === 0 && !isFormOpen ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <Users className="w-12 h-12 text-gray-700 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-300">No personas yet</h3>
          <p className="text-gray-500 mt-1 mb-4">Create a persona to define who your agent is talking to.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {personas.map((persona) => (
            <div key={persona.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-white text-lg">{persona.name}</h3>
                <span className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded-full uppercase tracking-wider">
                  {persona.tone}
                </span>
              </div>
              <p className="text-sm text-gray-400 line-clamp-3">{persona.background}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
