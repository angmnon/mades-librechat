// =============================================================================
// MADES Agent OS - Replay Studio（IDE 式 Workflow 调试器）
// LibreChat: client/src/components/ReplayStudio/ReplayStudio.tsx
// =============================================================================
import React, { useState, useEffect, useCallback } from "react";

interface ReplaySession {
  id: string; originalTaskId: string; status: string;
  steps: ReplayStep[]; startedAt: number; completedAt: number | null;
}

interface ReplayStep {
  phase: "planner" | "context" | "memory" | "capability" | "execution" | "artifact";
  originalData: unknown; replayedData: unknown;
  match: boolean; duration: number; error?: string;
}

interface ReplayDiff {
  planMatch: boolean; contextMatch: boolean; memoryMatch: boolean;
  executionMatch: boolean; costDiff: number; latencyDiff: number; stepsMatch: boolean;
}

interface Reconstruction {
  taskId: string; totalEvents: number;
  nodeSequence: Array<{ nodeId: string; eventType: string; payload: Record<string, unknown>; timestamp: number }>;
  modelCalls: Array<{ model: string; tokensIn: number; tokensOut: number; latencyMs: number; costUsd: number }>;
  toolCalls: Array<{ toolName: string; capability: string; input: unknown; output: unknown; durationMs: number }>;
}

export default function ReplayStudio() {
  const [taskId, setTaskId] = useState("");
  const [session, setSession] = useState<ReplaySession | null>(null);
  const [reconstruction, setReconstruction] = useState<Reconstruction | null>(null);
  const [diff, setDiff] = useState<ReplayDiff | null>(null);
  const [loading, setLoading] = useState(false);
  const [activePhase, setActivePhase] = useState<string>("all");
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  async function handleCreateReplay() {
    if (!taskId.trim()) return;
    setLoading(true);
    try {
      const r = await fetch("/api/v1/replay", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, restoreContext: true, restoreMemory: true, useSameModel: true, dryRun: true }),
      });
      const d = await r.json() as { session: ReplaySession; reconstruction: Reconstruction };
      setSession(d.session);
      setReconstruction(d.reconstruction);
      setDiff(null);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function handleExecuteReplay() {
    if (!session) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/v1/replay/${session.id}/execute`, { method: "POST" });
      const d = await r.json() as { session: ReplaySession; diff: ReplayDiff };
      setSession(d.session);
      setDiff(d.diff);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  const toggleNode = useCallback((nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId); else next.add(nodeId);
      return next;
    });
  }, []);

  const phases = ["planner", "context", "memory", "capability", "execution", "artifact"];
  const filteredSteps = session?.steps.filter(s => activePhase === "all" || s.phase === activePhase) ?? [];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Replay Studio</h1>

      {/* Input bar */}
      <div className="flex gap-2 mb-6">
        <input type="text" value={taskId} onChange={e => setTaskId(e.target.value)}
          placeholder="Enter Task ID to replay..."
          className="flex-1 px-4 py-2 border rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button onClick={handleCreateReplay} disabled={loading || !taskId.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50">Load & Reconstruct</button>
        {session && (
          <button onClick={handleExecuteReplay} disabled={loading}
            className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium disabled:opacity-50">Execute Replay</button>
        )}
      </div>

      {loading && <div className="text-center py-12 text-gray-500">Loading replay data...</div>}

      {session && (
        <div className="grid grid-cols-3 gap-6">
          {/* Left: Phase Tabs + Step Details */}
          <div className="col-span-2 space-y-4">
            {/* Phase tabs */}
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              <PhaseTab label="All" phase="all" active={activePhase} onClick={setActivePhase} />
              {phases.map(p => <PhaseTab key={p} label={p} phase={p} active={activePhase} onClick={setActivePhase} />)}
            </div>

            {/* Steps */}
            <div className="space-y-2">
              {filteredSteps.map((step, i) => (
                <div key={i} className={`rounded-lg border p-3 ${step.match ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase px-2 py-0.5 rounded bg-gray-200">{step.phase}</span>
                      <span className="text-sm font-medium">{step.match ? "✅ Match" : "❌ Diff"}</span>
                      <span className="text-xs text-gray-500">{step.duration}ms</span>
                    </div>
                    <button onClick={() => toggleNode(`step-${i}`)}
                      className="text-xs text-gray-400 hover:text-gray-600">Details</button>
                  </div>
                  {step.error && <p className="text-xs text-red-600 mt-1">{step.error}</p>}
                  {expandedNodes.has(`step-${i}`) && (
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-white rounded p-2 overflow-auto max-h-32">
                        <p className="font-medium text-gray-500 mb-1">Original</p>
                        <pre className="whitespace-pre-wrap">{JSON.stringify(step.originalData, null, 2).slice(0, 500)}</pre>
                      </div>
                      <div className="bg-white rounded p-2 overflow-auto max-h-32">
                        <p className="font-medium text-gray-500 mb-1">Replayed</p>
                        <pre className="whitespace-pre-wrap">{JSON.stringify(step.replayedData, null, 2).slice(0, 500)}</pre>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right: Summary + Diff */}
          <div className="space-y-4">
            {/* Session info */}
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-semibold text-sm mb-2">Session</h3>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-gray-500">Status</span><span>{session.status}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Task</span><span className="font-mono">{session.originalTaskId}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Steps</span><span>{session.steps.length}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Started</span><span>{new Date(session.startedAt).toLocaleString()}</span></div>
              </div>
            </div>

            {/* Diff summary */}
            {diff && (
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="font-semibold text-sm mb-2">Comparison</h3>
                <div className="space-y-1.5">
                  <DiffRow label="Plan" match={diff.planMatch} />
                  <DiffRow label="Context" match={diff.contextMatch} />
                  <DiffRow label="Memory" match={diff.memoryMatch} />
                  <DiffRow label="Execution" match={diff.executionMatch} />
                  <DiffRow label="All Steps" match={diff.stepsMatch} />
                  <hr className="my-2" />
                  <div className="flex justify-between text-xs"><span className="text-gray-500">Cost Diff</span><span className={diff.costDiff > 0 ? "text-red-600" : "text-green-600"}>${diff.costDiff.toFixed(4)}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-gray-500">Latency Diff</span><span className={diff.latencyDiff > 0 ? "text-red-600" : "text-green-600"}>{diff.latencyDiff}ms</span></div>
                </div>
              </div>
            )}

            {/* Model calls */}
            {reconstruction && reconstruction.modelCalls.length > 0 && (
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="font-semibold text-sm mb-2">Model Calls ({reconstruction.modelCalls.length})</h3>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {reconstruction.modelCalls.map((mc, i) => (
                    <div key={i} className="py-1 border-b last:border-0 text-xs">
                      <p className="font-medium">{mc.model}</p>
                      <p className="text-gray-500">Tokens: {mc.tokensIn}↑ / {mc.tokensOut}↓ · {mc.latencyMs}ms · ${mc.costUsd.toFixed(4)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tool calls */}
            {reconstruction && reconstruction.toolCalls.length > 0 && (
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="font-semibold text-sm mb-2">Tool Calls ({reconstruction.toolCalls.length})</h3>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {reconstruction.toolCalls.map((tc, i) => (
                    <div key={i} className="py-1 border-b last:border-0 text-xs">
                      <p className="font-medium">{tc.toolName} <span className="text-gray-400">({tc.capability})</span></p>
                      <p className="text-gray-500">{tc.durationMs}ms</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PhaseTab({ label, phase, active, onClick }: { label: string; phase: string; active: string; onClick: (p: string) => void }) {
  return (
    <button onClick={() => onClick(phase)}
      className={`flex-1 py-1.5 rounded text-xs font-medium capitalize transition-all ${active === phase ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
      {label}
    </button>
  );
}

function DiffRow({ label, match }: { label: string; match: boolean }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-gray-500">{label}</span>
      <span className={match ? "text-green-600" : "text-red-600"}>{match ? "✓ MATCH" : "✗ DIFF"}</span>
    </div>
  );
}
