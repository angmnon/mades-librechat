// =============================================================================
// MADES Agent OS - Health Panel
// LibreChat: client/src/components/Health/HealthPanel.tsx
// 路由: /health
// =============================================================================
import React, { useState, useEffect } from "react";

interface HealthComponent {
  status: "healthy" | "warning" | "critical";
  latency: number;
  lastChecked: number;
  error?: string;
}

interface HealthReport {
  status: "healthy" | "warning" | "critical";
  timestamp: number;
  components: Record<string, HealthComponent>;
}

interface CircuitSummary {
  total: number;
  open: number;
  halfOpen: number;
  entries: Array<{ key: string; state: string; failureCount: number; lastError: string | null }>;
}

export default function HealthPanel() {
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [circuits, setCircuits] = useState<CircuitSummary | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    loadHealth();
    const interval = autoRefresh ? setInterval(loadHealth, 5000) : undefined;
    return () => clearInterval(interval);
  }, [autoRefresh]);

  async function loadHealth() {
    try {
      const [healthRes, circuitRes] = await Promise.all([
        fetch("/api/health"),
        fetch("/api/v1/circuit-breakers"),
      ]);
      if (healthRes.ok) setHealth(await healthRes.json());
      if (circuitRes.ok) setCircuits(await circuitRes.json());
    } catch {}
  }

  if (!health) return <div className="p-6 text-center">Loading...</div>;

  const componentNames: Record<string, string> = {
    d1: "D1 Database", kv: "KV Store", hermes: "Hermes Runtime",
    planner: "Planner", execution: "Execution Engine", gateway: "Gateway",
    memory: "Memory Service", artifact: "Artifact Pipeline",
    guardrail: "Guardrail Service", ops: "Ops Center",
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">System Health</h1>
          <p className="text-sm text-gray-500">Last checked: {new Date(health.timestamp).toLocaleString()}</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1 text-sm">
            <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
            Auto-refresh (5s)
          </label>
          <span className={`px-3 py-1 rounded-full text-sm font-bold ${statusDot(health.status)}`}>
            {health.status.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Health grid */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        {Object.entries(health.components).map(([key, comp]) => (
          <div key={key} className={`rounded-lg p-4 border-l-4 ${borderColor(comp.status)} bg-white shadow-sm`}>
            <div className="flex items-center justify-between">
              <p className="font-medium">{componentNames[key] || key}</p>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusDot(comp.status)}`}>
                {comp.status}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {comp.latency > 0 ? `Latency: ${comp.latency}ms` : "N/A"}
              {comp.error && <span className="text-red-500 ml-2">⚠ {comp.error}</span>}
            </p>
          </div>
        ))}
      </div>

      {/* Circuit Breakers */}
      {circuits && circuits.total > 0 && (
        <div className="mb-8 bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold text-lg mb-3">
            Circuit Breakers
            <span className="text-sm font-normal text-gray-500 ml-2">
              {circuits.open} open · {circuits.halfOpen} half-open · {circuits.total} total
            </span>
          </h2>
          {circuits.open > 0 && (
            <div className="space-y-2">
              {circuits.entries.filter(e => e.state === "OPEN").map(e => (
                <div key={e.key} className="flex items-center justify-between p-2 bg-red-50 rounded text-sm">
                  <span className="font-medium">{e.key}</span>
                  <span className="text-red-600">Failures: {e.failureCount}</span>
                  {e.lastError && <span className="text-xs text-red-500 ml-2 truncate max-w-[300px]">{e.lastError}</span>}
                  <button onClick={() => fetch(`/api/v1/circuit-breakers/${e.key}/reset`, { method: "POST" }).then(loadHealth)}
                    className="px-2 py-0.5 bg-gray-200 rounded text-xs hover:bg-gray-300">Reset</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SLO Summary */}
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="font-semibold text-lg mb-3">SLO Status</h2>
        <SLOGrid />
      </div>
    </div>
  );
}

function SLOGrid() {
  const [slos, setSlos] = useState<Array<{ metric: string; actual: number; target: number; compliant: boolean }>>([]);

  useEffect(() => {
    fetch("/api/v1/slo")
      .then(r => r.json())
      .then(d => setSlos(d.results || []))
      .catch(() => {});
  }, []);

  if (slos.length === 0) return <p className="text-sm text-gray-400">No SLO data available</p>;

  return (
    <div className="space-y-2">
      {slos.map(slo => (
        <div key={slo.metric} className="flex items-center justify-between py-1.5 border-b last:border-0">
          <span className="text-sm">{slo.metric}</span>
          <div className="flex items-center gap-3">
            <span className="text-sm font-mono">{typeof slo.actual === "number" ? (slo.actual > 100 ? `${slo.actual}ms` : `${slo.actual.toFixed(1)}%`) : "N/A"}</span>
            <span className="text-xs text-gray-400">Target: {slo.target > 100 ? `${slo.target}ms` : `${slo.target}%`}</span>
            {slo.compliant ? <span className="text-green-600">✓</span> : <span className="text-red-600">✗</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function statusDot(s: string): string {
  switch (s) {
    case "healthy": return "bg-green-100 text-green-800";
    case "warning": return "bg-yellow-100 text-yellow-800";
    case "critical": return "bg-red-100 text-red-800";
    default: return "bg-gray-100 text-gray-700";
  }
}

function borderColor(s: string): string {
  return s === "healthy" ? "border-green-500" : s === "warning" ? "border-yellow-500" : "border-red-500";
}
