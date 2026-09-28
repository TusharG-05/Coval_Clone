"use client";
import { useState, useEffect } from "react";
import { Bot, Plus, X, Globe, Phone, Code, Cpu } from "lucide-react";

import { Agent } from "@/types";
export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  
  const initialFormData = {
    name: "",
    type: "voice",
    connection_type: "internal",
    connection_config: { system_prompt: "" } as Record<string, unknown>
  };
  const [formData, setFormData] = useState(initialFormData);

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/agents");
      const data = await res.json();
      setAgents(data);
    } catch (error) {
      console.error("Failed to fetch agents:", error);
    }
  };

  const handleConnectionTypeChange = (type: string) => {
    let newConfig = {};
    if (type === "internal") newConfig = { system_prompt: "" };
    if (type === "rest_api") newConfig = { endpoint_url: "", api_key: "" };
    if (type === "websocket") newConfig = { ws_url: "", auth_token: "" };
    if (type === "phone") newConfig = { phone_number: "", twilio_account_sid: "", twilio_auth_token: "" };
    
    setFormData({
      ...formData,
      connection_type: type,
      connection_config: newConfig
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("http://localhost:8000/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setIsFormOpen(false);
        setFormData(initialFormData);
        fetchAgents();
      }
    } catch (error) {
      console.error("Failed to create agent:", error);
    }
  };

  const getConnectionIcon = (type: string) => {
    switch (type) {
      case "rest_api": return <Globe className="w-4 h-4 text-emerald-400" />;
      case "websocket": return <Code className="w-4 h-4 text-purple-400" />;
      case "phone": return <Phone className="w-4 h-4 text-amber-400" />;
      default: return <Cpu className="w-4 h-4 text-blue-400" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bot className="h-6 w-6 text-blue-400" />
            Agents
          </h1>
          <p className="text-gray-400 mt-1">Connections to the voice or chat agents you want to test.</p>
        </div>
        <button 
          onClick={() => setIsFormOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Agent
        </button>
      </div>

      {isFormOpen && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-white">Create New Agent Connection</h2>
            <button onClick={() => setIsFormOpen(false)} className="text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Agent Name</label>
                <input 
                  required
                  type="text" 
                  className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-white outline-none focus:border-blue-500"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Agent Interface</label>
                <select 
                  className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-white outline-none focus:border-blue-500"
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.target.value})}
                >
                  <option value="voice">Voice</option>
                  <option value="chat">Chat</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Connection Type</label>
              <select 
                className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-white outline-none focus:border-blue-500"
                value={formData.connection_type}
                onChange={(e) => handleConnectionTypeChange(e.target.value)}
              >
                <option value="internal">Internal LLM (Mock Agent)</option>
                <option value="rest_api">REST API / Webhook</option>
                <option value="websocket">WebSocket Stream</option>
                <option value="phone">Phone Number (Twilio SIP)</option>
              </select>
            </div>

            <div className="p-4 bg-gray-950 border border-gray-800 rounded-lg space-y-4 mt-2">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Connection Settings</h3>
              
              {formData.connection_type === "internal" && (
                <div>
                  <label className="block text-sm text-gray-300 mb-1">System Prompt</label>
                  <textarea 
                    required
                    rows={3}
                    placeholder="You are a helpful customer support agent..."
                    className="w-full bg-gray-900 border border-gray-800 rounded p-2 text-white outline-none focus:border-blue-500"
                    value={(formData.connection_config.system_prompt as string) || ""}
                    onChange={(e) => setFormData({...formData, connection_config: { system_prompt: e.target.value }})}
                  />
                </div>
              )}

              {formData.connection_type === "rest_api" && (
                <>
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Endpoint URL</label>
                    <input 
                      required
                      type="url" 
                      placeholder="https://api.maica24.com/v1/chat"
                      className="w-full bg-gray-900 border border-gray-800 rounded p-2 text-white outline-none focus:border-emerald-500"
                      value={(formData.connection_config.endpoint_url as string) || ""}
                      onChange={(e) => setFormData({...formData, connection_config: { ...formData.connection_config, endpoint_url: e.target.value }})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">API Key (Optional)</label>
                    <input 
                      type="password" 
                      placeholder="sk-..."
                      className="w-full bg-gray-900 border border-gray-800 rounded p-2 text-white outline-none focus:border-emerald-500"
                      value={(formData.connection_config.api_key as string) || ""}
                      onChange={(e) => setFormData({...formData, connection_config: { ...formData.connection_config, api_key: e.target.value }})}
                    />
                  </div>
                </>
              )}

              {formData.connection_type === "websocket" && (
                <>
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">WebSocket URL</label>
                    <input 
                      required
                      type="text" 
                      placeholder="wss://api.maica24.com/stream"
                      className="w-full bg-gray-900 border border-gray-800 rounded p-2 text-white outline-none focus:border-purple-500"
                      value={(formData.connection_config.ws_url as string) || ""}
                      onChange={(e) => setFormData({...formData, connection_config: { ...formData.connection_config, ws_url: e.target.value }})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Auth Token (Optional)</label>
                    <input 
                      type="password" 
                      className="w-full bg-gray-900 border border-gray-800 rounded p-2 text-white outline-none focus:border-purple-500"
                      value={(formData.connection_config.auth_token as string) || ""}
                      onChange={(e) => setFormData({...formData, connection_config: { ...formData.connection_config, auth_token: e.target.value }})}
                    />
                  </div>
                </>
              )}

              {formData.connection_type === "phone" && (
                <>
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Target Phone Number</label>
                    <input 
                      required
                      type="tel" 
                      placeholder="+1 (555) 012-3456"
                      className="w-full bg-gray-900 border border-gray-800 rounded p-2 text-white outline-none focus:border-amber-500"
                      value={(formData.connection_config.phone_number as string) || ""}
                      onChange={(e) => setFormData({...formData, connection_config: { ...formData.connection_config, phone_number: e.target.value }})}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-300 mb-1">Twilio Account SID</label>
                      <input 
                        type="text" 
                        className="w-full bg-gray-900 border border-gray-800 rounded p-2 text-white outline-none focus:border-amber-500"
                        value={(formData.connection_config.twilio_account_sid as string) || ""}
                        onChange={(e) => setFormData({...formData, connection_config: { ...formData.connection_config, twilio_account_sid: e.target.value }})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-300 mb-1">Twilio Auth Token</label>
                      <input 
                        type="password" 
                        className="w-full bg-gray-900 border border-gray-800 rounded p-2 text-white outline-none focus:border-amber-500"
                        value={(formData.connection_config.twilio_auth_token as string) || ""}
                        onChange={(e) => setFormData({...formData, connection_config: { ...formData.connection_config, twilio_auth_token: e.target.value }})}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            <button type="submit" className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium w-full mt-4">
              Save Agent Connection
            </button>
          </form>
        </div>
      )}

      {agents.length === 0 && !isFormOpen ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <Bot className="w-12 h-12 text-gray-700 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-300">No agents yet</h3>
          <p className="text-gray-500 mt-1 mb-4">Create your first agent connection to start testing.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {agents.map((agent) => (
            <div key={agent.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-bold text-white text-xl">{agent.name}</h3>
                  <span className="text-xs font-semibold bg-gray-800 text-gray-300 px-3 py-1 rounded-full uppercase tracking-wider">
                    {agent.type}
                  </span>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-gray-400 text-sm">
                    {getConnectionIcon(agent.connection_type)}
                    <span className="capitalize">{agent.connection_type.replace('_', ' ')} Connection</span>
                  </div>
                  
                  {agent.connection_type === "rest_api" && (
                    <p className="text-sm text-gray-500 truncate" title={(agent.connection_config.endpoint_url as string)}>
                      URL: {(agent.connection_config.endpoint_url as string)}
                    </p>
                  )}
                  {agent.connection_type === "websocket" && (
                    <p className="text-sm text-gray-500 truncate" title={(agent.connection_config.ws_url as string)}>
                      WS: {(agent.connection_config.ws_url as string)}
                    </p>
                  )}
                  {agent.connection_type === "phone" && (
                    <p className="text-sm text-gray-500">
                      Dialing: {(agent.connection_config.phone_number as string)}
                    </p>
                  )}
                  {agent.connection_type === "internal" && (
                    <p className="text-sm text-gray-500 italic line-clamp-1">
                      &quot;{String(agent.connection_config.system_prompt)}&quot;
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
