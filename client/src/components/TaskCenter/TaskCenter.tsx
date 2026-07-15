// =============================================================================
// MADES Agent OS - Task Center + DAG 可视化 + Event 时间线
// LibreChat 集成: client/src/components/TaskCenter/TaskCenter.tsx
// 路由: /tasks/:taskId
// =============================================================================
import React, { useState, useEffect } from "react";

interface TaskDetail {
  taskId: string;
  status: string;
  goal: string;
  nodes: Map<string, NodeDetail>;
  edges: Array<[string, string]>;
  traceId: string;
  createdAt: number;
  updatedAt: number;
}

interface NodeDetail {
  id: string;
  name: string;
  status: string;
  capability: string;
  retryCount: number;
  dispatchedAt: number | null;
  completedAt: number | null;
  result: { success?: boolean; tokensUsed?: { input: number; output: number }; costUsd?: number; artifactRefs?: string[] } | null;
}

interface TimelineEvent {
  id: string;
  eventType: string;
  nodeId: string | null;
  payload: Record<string, unknown>;
  createdAt: number;
}

export default function TaskCenter({ taskId = "latest" }: { taskId?: string }) {
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [approvals, setApprovals] = useState<Array<{ id: string; status: string; riskScore: number; reason: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  useEffect(() => {
    loadTask();
  }, [taskId]);

  async function loadTask() {
    setLoading(true);
    try {
      const [taskRes, eventsRes, approvalsRes] = await Promise.all([
        fetch(`/api/v1/tasks/${taskId}`),
        fetch(`/api/v1/tasks/${taskId}/events`),
        fetch(`/api/v1/approval?workflowId=${taskId}`),
      ]);
      if (taskRes.ok) setTask(await taskRes.json());
      if (eventsRes.ok) setEvents((await eventsRes.json()).events || []);
      if (approvalsRes.ok) setApprovals((await approvalsRes.json()).approvals || []);
    } catch (err) {
      console.error("Failed to load task:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(action: "pause" | "resume" | "cancel") {
    await fetch(`/api/v1/tasks/${taskId}/${action}`, { method: "POST" });
    setTimeout(loadTask, 500);
  }

  async function handleApproval(approvalId: string, action: "approve" | "reject") {
    await fetch(`/api/v1/approval/${approvalId}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setTimeout(loadTask, 500);
  }

  if (loading) return <div className="p-6 text-center text-gray-500">Loading task details...</div>;
  if (!task) return <div className="p-6 text-center text-red-500">Task not found</div>;

  const nodeList = Array.from(task.nodes?.entries?.() || []) as Array<[string, NodeDetail]>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Task: {task.goal}</h1>
          <p className="text-sm text-gray-500 mt-1">ID: {task.taskId} · Trace: {task.traceId} · Created: {new Date(task.createdAt).toLocaleString()}</p>
        </div>
        <div className="flex gap-2">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${taskStatusBadge(task.status)}`}>{task.status}</span>
          <button onClick={() => handleAction("pause")} disabled={task.status !== "running"} className="px-3 py-1 bg-yellow-500 text-white rounded text-sm disabled:opacity-30">Pause</button>
          <button onClick={() => handleAction("resume")} disabled={task.status !== "paused"} className="px-3 py-1 bg-green-600 text-white rounded text-sm disabled:opacity-30">Resume</button>
          <button onClick={() => handleAction("cancel")} className="px-3 py-1 bg-red-600 text-white rounded text-sm">Cancel</button>
        </div>
      </div>

      {/* DAG Visualization */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <h2 className="font-semibold text-lg mb-4">Workflow DAG</h2>
        <div className="flex flex-wrap gap-4 justify-center">
          {nodeList.map(([id, node]) => (
            <div
              key={id}
              className={`relative border-2 rounded-lg p-3 cursor-pointer min-w-[140px] text-center transition-all
                ${selectedNode === id ? "border-blue-500 ring-2 ring-blue-200" : "border-gray-200 hover:border-gray-400"}
                ${node.status === "succeeded" ? "bg-green-50" : node.status === "failed" ? "bg-red-50" : node.status === "running" ? "bg-blue-50 animate-pulse" : "bg-gray-50"}`}
              onClick={() => setSelectedNode(id)}
            >
              <p className="text-xs font-bold text-gray-500 uppercase">{node.capability}</p>
              <p className="text-sm font-medium mt-1">{node.name}</p>
              <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-xs ${nodeStatusColor(node.status)}`}>{node.status}</span>
              {node.retryCount > 0 && <p className="text-xs text-orange-500 mt-1">Retries: {node.retryCount}</p>}
            </div>
          ))}
        </div>
        {/* Edges indicator */}
        {task.edges && task.edges.length > 0 && (
          <div className="mt-4 text-center">
            <p className="text-xs text-gray-400">
              Dependencies: {task.edges.map(([from, to]) => `${from}→${to}`).join(", ")}
            </p>
          </div>
        )}
      </div>

      {/* Two-column detail view */}
      <div className="grid grid-cols-2 gap-6">
        {/* Selected Node Detail */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold text-lg mb-3">Node Detail</h2>
          {selectedNode ? ((n) => {
            const node = nodeList.find(([id]) => id === selectedNode)?.[1];
            if (!node) return <p className="text-gray-400">Select a node in the DAG above</p>;
            return (
              <div className="space-y-2 text-sm">
                <DetailRow label="Name" value={node.name} />
                <DetailRow label="Capability" value={node.capability} />
                <DetailRow label="Status" value={node.status} />
                <DetailRow label="Retry Count" value={String(node.retryCount)} />
                {node.dispatchedAt && <DetailRow label="Dispatched" value={new Date(node.dispatchedAt).toLocaleString()} />}
                {node.completedAt && <DetailRow label="Completed" value={new Date(node.completedAt).toLocaleString()} />}
                {node.result?.tokensUsed && (
                  <DetailRow label="Tokens" value={`${node.result.tokensUsed.input}↑ / ${node.result.tokensUsed.output}↓`} />
                )}
                {node.result?.costUsd !== undefined && (
                  <DetailRow label="Cost" value={`$${node.result.costUsd.toFixed(4)}`} />
                )}
                {node.result?.artifactRefs && node.result.artifactRefs.length > 0 && (
                  <DetailRow label="Artifacts" value={node.result.artifactRefs.join(", ")} />
                )}
              </div>
            );
          })() : <p className="text-gray-400">Select a node in the DAG above</p>}
        </div>

        {/* Event Timeline */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold text-lg mb-3">Event Timeline ({events.length})</h2>
          <div className="max-h-96 overflow-y-auto">
            {events.length === 0 ? (
              <p className="text-gray-400 text-sm">No events recorded</p>
            ) : (
              <div className="space-y-1">
                {events.map(event => (
                  <div key={event.id} className="flex items-start gap-2 py-1.5 border-b last:border-0 text-xs">
                    <span className="text-gray-400 w-20 shrink-0">{new Date(event.createdAt).toLocaleTimeString()}</span>
                    <span className={`px-1 py-0.5 rounded ${eventTypeColor(event.eventType)}`}>{event.eventType}</span>
                    {event.nodeId && <span className="text-gray-500">{event.nodeId}</span>}
                    {event.payload?.reason && <span className="text-gray-600 ml-1 truncate">{String(event.payload.reason)}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Approval Cards */}
      {approvals.length > 0 && (
        <div className="mt-6 bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold text-lg mb-3 text-orange-600">Pending Approvals ({approvals.length})</h2>
          <div className="space-y-3">
            {approvals.map(a => (
              <div key={a.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                <div className="flex-1">
                  <p className="text-sm font-medium">Risk Score: {a.riskScore}</p>
                  <p className="text-xs text-gray-600">{a.reason}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleApproval(a.id, "approve")} className="px-3 py-1 bg-green-600 text-white rounded text-xs">Approve</button>
                  <button onClick={() => handleApproval(a.id, "reject")} className="px-3 py-1 bg-red-600 text-white rounded text-xs">Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function taskStatusBadge(s: string): string {
  switch (s) {
    case "completed": return "bg-green-100 text-green-800";
    case "failed": return "bg-red-100 text-red-800";
    case "running": return "bg-blue-100 text-blue-800 animate-pulse";
    case "paused": return "bg-yellow-100 text-yellow-800";
    default: return "bg-gray-100 text-gray-700";
  }
}

function nodeStatusColor(s: string): string {
  switch (s) {
    case "succeeded": return "bg-green-100 text-green-700";
    case "failed": return "bg-red-100 text-red-700";
    case "running": case "dispatching": return "bg-blue-100 text-blue-700";
    case "retry": return "bg-orange-100 text-orange-700";
    case "waiting": return "bg-yellow-100 text-yellow-700";
    default: return "bg-gray-100 text-gray-600";
  }
}

function eventTypeColor(t: string): string {
  if (t.includes("created") || t.includes("started")) return "bg-blue-50 text-blue-700";
  if (t.includes("completed") || t.includes("succeeded")) return "bg-green-50 text-green-700";
  if (t.includes("failed") || t.includes("rejected")) return "bg-red-50 text-red-700";
  if (t.includes("retry")) return "bg-orange-50 text-orange-700";
  return "bg-gray-50 text-gray-600";
}
