"use client";
import { useState, useEffect } from "react";
import { Bot, Plus, X, Globe, Phone, Code, Cpu, Info, Edit, Trash2, Loader2 } from "lucide-react";

const InfoTooltip = ({ content, onClick }: { content: string, onClick?: () => void }) => (
  <div className="relative group inline-block ml-2 cursor-pointer">
    <Info className="w-4 h-4 text-gray-500 hover:text-blue-400 transition-colors" />
    <div className="absolute z-10 bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-64 bg-gray-800 text-white text-xs rounded shadow-lg p-3 border border-gray-700 font-normal">
      <p className="mb-2 text-gray-300 leading-relaxed">{content}</p>
      {onClick && (
        <button type="button" onClick={onClick} className="text-blue-400 hover:text-blue-300 hover:underline font-semibold block text-left">
          Click here for exact steps →
        </button>
      )}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
    </div>
  </div>
);

import { Agent } from "@/types";
export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [helpModal, setHelpModal] = useState<'credentials' | 'caller_id' | null>(null);
  
  const initialFormData = {
    name: "",
    type: "voice",
    connection_type: "internal",
    connection_config: { system_prompt: "" } as Record<string, unknown>
  };
  const [formData, setFormData] = useState(initialFormData);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("http://localhost:8000/api/agents");
      const data = await res.json();
      setAgents(data);
    } catch (error) {
      console.error("Failed to fetch agents:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnectionTypeChange = (type: string) => {
    let newConfig = {};
    if (type === "internal") newConfig = { system_prompt: "" };
    if (type === "rest_api") newConfig = { endpoint_url: "", api_key: "" };
    if (type === "websocket") newConfig = { ws_url: "", auth_token: "" };
    if (type === "phone") newConfig = { phone_number: "", twilio_account_sid: "", twilio_auth_token: "", caller_id: "" };
    
    setFormData({
      ...formData,
      connection_type: type,
      connection_config: newConfig
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingId 
        ? `http://localhost:8000/api/agents/${editingId}`
        : "http://localhost:8000/api/agents";
      const method = editingId ? "PUT" : "POST";
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setIsFormOpen(false);
        setEditingId(null);
        setFormData(initialFormData);
        fetchAgents();
      }
    } catch (error) {
      console.error("Failed to save agent:", error);
    }
  };

  const handleEdit = (agent: Agent) => {
    setFormData({
      name: agent.name,
      type: agent.type,
      connection_type: agent.connection_type,
      connection_config: { ...agent.connection_config } as Record<string, unknown>
    });
    setEditingId(agent.id);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this agent?")) return;
    try {
      const res = await fetch(`http://localhost:8000/api/agents/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchAgents();
      }
    } catch (error) {
      console.error("Failed to delete agent:", error);
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
          onClick={() => {
            setFormData(initialFormData);
            setEditingId(null);
            setIsFormOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Agent
        </button>
      </div>

      {isFormOpen && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-white">{editingId ? "Edit Agent Connection" : "Create New Agent Connection"}</h2>
            <button onClick={() => { setIsFormOpen(false); setEditingId(null); }} className="text-gray-400 hover:text-white">
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
                      <label className="flex items-center text-sm text-gray-300 mb-1 font-medium">
                        Twilio Account SID
                        <InfoTooltip 
                          content="Your unique Twilio Account Identifier used to authenticate API requests to make phone calls." 
                          onClick={() => setHelpModal('credentials')} 
                        />
                      </label>
                      <input 
                        type="text" 
                        className="w-full bg-gray-900 border border-gray-800 rounded p-2 text-white outline-none focus:border-amber-500"
                        value={(formData.connection_config.twilio_account_sid as string) || ""}
                        onChange={(e) => setFormData({...formData, connection_config: { ...formData.connection_config, twilio_account_sid: e.target.value }})}
                      />
                    </div>
                    <div>
                      <label className="flex items-center text-sm text-gray-300 mb-1 font-medium">
                        Twilio Auth Token
                        <InfoTooltip 
                          content="Your secret Twilio authentication token. Keep this safe and do not share it." 
                          onClick={() => setHelpModal('credentials')} 
                        />
                      </label>
                      <input 
                        type="password" 
                        className="w-full bg-gray-900 border border-gray-800 rounded p-2 text-white outline-none focus:border-amber-500"
                        value={(formData.connection_config.twilio_auth_token as string) || ""}
                        onChange={(e) => setFormData({...formData, connection_config: { ...formData.connection_config, twilio_auth_token: e.target.value }})}
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="flex items-center text-sm text-gray-300 mb-1 font-medium">
                      Custom Caller ID (Optional)
                      <InfoTooltip 
                        content="The phone number that will appear on Caller ID. It MUST be a verified number or a purchased Twilio number in your account." 
                        onClick={() => setHelpModal('caller_id')} 
                      />
                    </label>
                    <input 
                      type="tel" 
                      placeholder="+1 (Your Personal Number)"
                      className="w-full bg-gray-900 border border-gray-800 rounded p-2 text-white outline-none focus:border-amber-500"
                      value={(formData.connection_config.caller_id as string) || ""}
                      onChange={(e) => setFormData({...formData, connection_config: { ...formData.connection_config, caller_id: e.target.value }})}
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-4">
              <button 
                type="button"
                onClick={() => { setIsFormOpen(false); setEditingId(null); }}
                className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-medium w-full"
              >
                Cancel
              </button>
              <button type="submit" className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium w-full">
                {editingId ? "Update Agent Connection" : "Save Agent Connection"}
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
        </div>
      ) : agents.length === 0 && !isFormOpen ? (
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
                  <div className="flex flex-col gap-1">
                    <h3 className="font-bold text-white text-xl">{agent.name}</h3>
                    <span className="text-xs font-semibold bg-gray-800 text-gray-300 px-3 py-1 rounded-full uppercase tracking-wider w-fit">
                      {agent.type}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleEdit(agent)}
                      className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-gray-800 rounded transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(agent.id)}
                      className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
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

      {helpModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-md w-full relative">
            <button onClick={() => setHelpModal(null)} className="absolute top-4 right-4 text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            
            {helpModal === 'credentials' ? (
              <>
                <h2 className="text-xl font-bold text-white mb-4">How to get Twilio Credentials</h2>
                <ol className="list-decimal list-inside space-y-3 text-gray-300">
                  <li>Go to <strong>twilio.com</strong> and create a free account.</li>
                  <li>Upgrade your account (requires adding a $20 balance) to unlock outbound dialing. Free trials cannot call unverified numbers.</li>
                  <li>Navigate to your main <strong>Console Dashboard</strong>.</li>
                  <li>Scroll down to the <strong>Account Info</strong> section.</li>
                  <li>Copy the <strong>Account SID</strong> and <strong>Auth Token</strong>.</li>
                </ol>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold text-white mb-4">How to verify a Caller ID</h2>
                <ol className="list-decimal list-inside space-y-3 text-gray-300">
                  <li>Log in to your <strong>Twilio Dashboard</strong>.</li>
                  <li>Go to <strong>Phone Numbers &gt; Manage &gt; Verified Caller IDs</strong>.</li>
                  <li>Click <strong>Add a new Caller ID</strong>.</li>
                  <li>Enter your personal phone number and verify it via the SMS code Twilio sends you.</li>
                  <li>Once verified, you can use that exact number in this field!</li>
                </ol>
              </>
            )}

            <button onClick={() => setHelpModal(null)} className="w-full mt-6 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg font-medium transition-colors">
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
