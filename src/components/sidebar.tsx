"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bot,
  Database,
  LayoutDashboard,
  Play,
  Users,
  MessageSquare,
  Calendar,
  CheckSquare,
  ListTree
} from "lucide-react";

export function Sidebar() {
  const pathname = usePathname();

  const getLinkClass = (path: string) => {
    const isActive = pathname === path;
    return `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
        : "text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
    }`;
  };

  return (
    <aside className="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex-col hidden md:flex">
      <div className="h-16 flex items-center px-6 border-b border-gray-200 dark:border-gray-800">
        <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-emerald-600 dark:from-blue-400 dark:to-emerald-400">
          CovalClone
        </span>
      </div>
      
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-3">
          Core
        </div>
        <Link href="/" className={getLinkClass("/")}>
          <LayoutDashboard className="h-4 w-4" />
          Dashboard
        </Link>
        <Link href="/simulate" className={getLinkClass("/simulate")}>
          <Play className="h-4 w-4" />
          Simulate
        </Link>
        <Link href="/conversations" className={getLinkClass("/conversations")}>
          <MessageSquare className="h-4 w-4" />
          Observe
        </Link>
        <Link href="/schedules" className={getLinkClass("/schedules")}>
          <Calendar className="h-4 w-4" />
          Schedules
        </Link>
        <Link href="/review" className={getLinkClass("/review")}>
          <CheckSquare className="h-4 w-4" />
          Human Review
        </Link>
        <Link href="/traces" className={getLinkClass("/traces")}>
          <ListTree className="h-4 w-4" />
          Traces
        </Link>

        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-3 pt-8">
          Building Blocks
        </div>
        <Link href="/agents" className={getLinkClass("/agents")}>
          <Bot className="h-4 w-4" />
          Agents
        </Link>
        <Link href="/personas" className={getLinkClass("/personas")}>
          <Users className="h-4 w-4" />
          Personas
        </Link>
        <Link href="/test-sets" className={getLinkClass("/test-sets")}>
          <Database className="h-4 w-4" />
          Test Sets
        </Link>
        <Link href="/metrics" className={getLinkClass("/metrics")}>
          <Activity className="h-4 w-4" />
          Metrics
        </Link>
      </nav>
    </aside>
  );
}
