"use client";
import { useState, useEffect } from "react";
import { Activity, Bot, Play, MessageSquare, CheckSquare } from "lucide-react";
import Link from "next/link";

export default function Dashboard() {
  const [stats, setStats] = useState({
    total_simulations: 0,
    total_live_conversations: 0,
    total_agents: 0,
    total_metrics_evaluated: 0,
    human_reviews: 0,
    global_pass_rate: 0
  });

  useEffect(() => {
    fetch("http://localhost:8000/api/stats")
      .then(res => res.json())
      .then(data => setStats(data))
      .catch(err => console.error("Failed to fetch stats:", err));
  }, []);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Welcome to Coval Clone. Evaluate your AI agents before they go to production.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-500 rounded-lg">
              <Play className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Simulations Run</p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total_simulations}</h3>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-500 rounded-lg">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Global Pass Rate</p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{stats.global_pass_rate}%</h3>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-500 rounded-lg">
              <MessageSquare className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Live Calls</p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total_live_conversations}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-500 rounded-lg">
              <Bot className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Active Agents</p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total_agents}</h3>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-500 rounded-lg">
              <CheckSquare className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Human Overrides</p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{stats.human_reviews}</h3>
            </div>
          </div>
        </div>
      </div>

      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">Quick Actions</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href="/simulate" className="group p-6 bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl hover:shadow-lg transition-all relative overflow-hidden">
          <div className="absolute right-0 top-0 opacity-10 transform translate-x-4 -translate-y-4">
            <Play className="h-32 w-32" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2 relative z-10">Launch Simulation</h3>
          <p className="text-blue-100 text-sm max-w-sm relative z-10">Run an automated test conversation using your configured test sets and metrics.</p>
        </Link>
        
        <div className="grid grid-cols-1 gap-4">
          <Link href="/conversations" className="group p-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl hover:shadow-md transition-all flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-purple-500" /> Observe Live Calls
              </h3>
              <p className="text-gray-500 text-sm">Upload and auto-evaluate production transcripts.</p>
            </div>
          </Link>
          <Link href="/review" className="group p-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl hover:shadow-md transition-all flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                <CheckSquare className="h-5 w-5 text-indigo-500" /> Human Review
              </h3>
              <p className="text-gray-500 text-sm">QA your LLM judge by forcing Pass/Fail status.</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
