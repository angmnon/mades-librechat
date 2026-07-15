// =============================================================================
// MADES Agent OS - Workspace Dashboard
// LibreChat 集成: 复制到 client/src/components/Workspace/Dashboard.tsx
// 路由: /workspace/:workspaceId
// =============================================================================
import React, { useState, useEffect, useCallback } from "react";

interface WorkspaceStats {
  activeTasks: number;
  completedTasks: number;
  failedTasks: number;
  totalArtifacts: number;
  memoryCount: number;
  costToday: number;
  tokensToday: number;
}

interface RecentTask {
  id: string;
  goal: string;
  status: string;
  createdAt: number;
  completedAt: number | null;
}

interface RecentArtifact {
  id: string;
  title: string;
  type: string;
  version: number;
  createdAt: number;
}

interface MemorySummary {
  summary: string;
  count: number;
}

export default function WorkspaceDashboard() {
  const [stats, setStats] = useState<WorkspaceStats | null>(null);
  const [recentTasks, setRecentTasks] = useState<RecentTask[]>([]);
  const [recentArtifacts, setRecentArtifacts] = useState<RecentArtifact[]>([]);
  const [memorySummary, setMemorySummary] = useState<MemorySummary | null>(null);
  const [newGoal, setNewGoal] = useState("");
  const [loading, setLoading] = useState(true);

  const workspaceId = "default"; // From route params or context

  useEffect(() => {
    loadDashboard();
  }, [workspaceId]);

  async function loadDashboard() {
    setLoading(true);
    try {
      const [statsRes, tasksRes, artifactsRes, memoryRes] = await Promise.all([
        fetch(`/api/v1/metrics?workspaceId=${workspaceId}`),
        fetch(`/api/v1/tasks?workspaceId=${workspaceId}&limit=10`),
        fetch(`/api/v1/artifacts?workspaceId=${workspaceId}&limit=10`),
        fetch(`/api/v1/memory/summarize`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceId }) }),
      ]);

      if (statsRes.ok) {
        const d = await statsRes.json() as { workflows: { total: number; active: number; failed: number }; cost?: { today: { totalCost: number } } };
        setStats({
          activeTasks: d.workflows.active || 0,
          completedTasks: d.workflows.total - (d.workflows.failed || 0),
          failedTasks: d.workflows.failed || 0,
          totalArtifacts: 0,
          memoryCount: 0,
          costToday: d.cost?.today?.totalCost || 0,
          tokensToday: 0,
        });
      }
      if (tasksRes.ok) {
        const d = await tasksRes.json() as { tasks: RecentTask[] };
        setRecentTasks(d.tasks || []);
      }
      if (artifactsRes.ok) {
        const d = await artifactsRes.json() as { artifacts: RecentArtifact[] };
        setRecentArtifacts(d.artifacts || []);
        if (stats) setStats(s => ({ ...s!, totalArtifacts: d.artifacts?.length || 0 }));
      }
      if (memoryRes.ok) {
        const d = await memoryRes.json() as MemorySummary;
        setMemorySummary(d);
        if (stats) setStats(s => ({ ...s!, memoryCount: d.count || 0 }));
      }
    } catch (err) {
      console.error("Failed to load dashboard:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateTask() {
    if (!newGoal.trim()) return;
    try {
      const res = await fetch("/api/v1/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, goal: newGoal }),
      });
      if (res.ok) {
        setNewGoal("");
        const { taskId } = await res.json() as { taskId: string };
        // Start the task immediately
        await fetch(`/api/v1/tasks/${taskId}/start`, { method: "POST" });
        setTimeout(loadDashboard, 1000);
      }
    } catch (err) {
      console.error("Failed to create task:", err);
    }
  }

  if (loading) return <div className="p-6 text-center text-gray-500">Loading workspace dashboard...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Workspace Dashboard</h1>

      {/* Quick create */}
      <div className="flex gap-2 mb-8">
        <input
          type="text"
          value={newGoal}
          onChange={e => setNewGoal(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleCreateTask()}
          placeholder="What do you want the Agent to do?"
          className="flex-1 px-4 py-3 border rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleCreateTask}
          disabled={!newGoal.trim()}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold disabled:opacity-50 hover:bg-blue-700"
        >
          Execute
        </button>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-4 gap-4 mb-8">
          <StatCard label="Active Tasks" value={stats.activeTasks} color="blue" />
          <StatCard label="Completed" value={stats.completedTasks} color="green" />
          <StatCard label="Failed" value={stats.failedTasks} color="red" />
          <StatCard label="Artifacts" value={stats.totalArtifacts} color="purple" />
          <StatCard label="Memories" value={stats.memoryCount} color="yellow" />
          <StatCard label="Cost Today" value={`$${stats.costToday?.toFixed(2)}`} color="orange" />
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-2 gap-6">
        {/* Recent Tasks */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold text-lg mb-3">Recent Tasks</h2>
          {recentTasks.length === 0 ? (
            <p className="text-gray-400">No tasks yet. Create one above.</p>
          ) : (
            <ul className="space-y-2">
              {recentTasks.map(task => (
                <li key={task.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">{task.goal}</p>
                    <p className="text-xs text-gray-500">{new Date(task.createdAt).toLocaleString()}</p>
                  </div>
                  <span className={`ml-2 px-2 py-0.5 rounded text-xs ${statusColor(task.status)}`}>
                    {task.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent Artifacts */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold text-lg mb-3">Recent Artifacts</h2>
          {recentArtifacts.length === 0 ? (
            <p className="text-gray-400">No artifacts yet.</p>
          ) : (
            <ul className="space-y-2">
              {recentArtifacts.map(art => (
                <li key={art.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{art.title}</p>
                    <p className="text-xs text-gray-500">v{art.version} · {art.type}</p>
                  </div>
                  <a href={`/artifacts/${art.id}`} className="text-blue-600 text-xs hover:underline">View</a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Memory Summary */}
      {memorySummary && (
        <div className="mt-6 bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold text-lg mb-3">Workspace Memory ({memorySummary.count} items)</h2>
          <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{memorySummary.summary}</pre>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700", green: "bg-green-50 text-green-700",
    red: "bg-red-50 text-red-700", purple: "bg-purple-50 text-purple-700",
    yellow: "bg-yellow-50 text-yellow-700", orange: "bg-orange-50 text-orange-700",
  };
  return (
    <div className={`rounded-lg p-4 ${colors[color] || "bg-gray-50 text-gray-700"}`}>
      <p className="text-xs uppercase tracking-wide font-medium">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

function statusColor(status: string): string {
  switch (status) {
    case "completed": return "bg-green-100 text-green-800";
    case "failed": return "bg-red-100 text-red-800";
    case "cancelled": return "bg-gray-100 text-gray-600";
    default: return "bg-blue-100 text-blue-800";
  }
}
