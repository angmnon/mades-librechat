// =============================================================================
// MADES Agent OS - Artifact Page（版本历史 + 预览 + 对比）
// LibreChat: client/src/components/Artifacts/ArtifactPage.tsx
// =============================================================================
import React, { useState, useEffect } from "react";

interface ArtifactDetail {
  id: string; title: string; type: string; version: number;
  size: number; status: string; permission: string;
  createdAt: number; taskNodeId: string;
  summary?: string; downloadUrl?: string;
}

interface VersionInfo {
  id: string; version: number; size: number; hash: string; createdAt: number;
}

interface DependencyInfo {
  dependsOn: ArtifactDetail[];
  dependedBy: ArtifactDetail[];
}

export default function ArtifactPage({ artifactId }: { artifactId: string }) {
  const [artifact, setArtifact] = useState<ArtifactDetail | null>(null);
  const [versions, setVersions] = useState<VersionInfo[]>([]);
  const [deps, setDeps] = useState<DependencyInfo | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [diffA, setDiffA] = useState<number | null>(null);
  const [diffB, setDiffB] = useState<number | null>(null);
  const [previewContent, setPreviewContent] = useState<string>("");

  useEffect(() => { loadArtifact(); }, [artifactId, selectedVersion]);

  async function loadArtifact() {
    try {
      const verParam = selectedVersion ? `?version=${selectedVersion}` : "";
      const [artRes, verRes, depRes] = await Promise.all([
        fetch(`/api/v1/artifacts/${artifactId}${verParam}`),
        fetch(`/api/v1/artifacts/${artifactId}/versions`),
        fetch(`/api/v1/artifacts/${artifactId}/dependencies`),
      ]);
      if (artRes.ok) { const d = await artRes.json() as ArtifactDetail; setArtifact(d); }
      if (verRes.ok) { const d = await verRes.json() as { versions: VersionInfo[] }; setVersions(d.versions || []); }
      if (depRes.ok) { const d = await depRes.json() as DependencyInfo; setDeps(d); }
      // Load preview
      const prevRes = await fetch(`/api/v1/artifacts/${artifactId}/preview${verParam}`);
      if (prevRes.ok) setPreviewContent(await prevRes.text());
    } catch (err) { console.error(err); }
  }

  async function handleConvert(format: string) {
    await fetch("/api/v1/artifacts/convert", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ artifactId, targetFormat: format }),
    });
  }

  if (!artifact) return <div className="p-6 text-center">Loading...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{artifact.title}</h1>
          <p className="text-sm text-gray-500">
            v{artifact.version} · {artifact.type} · {formatBytes(artifact.size)} · {artifact.status}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => handleConvert("html")} className="px-3 py-1 bg-gray-100 rounded text-sm hover:bg-gray-200">HTML</button>
          <button onClick={() => handleConvert("docx")} className="px-3 py-1 bg-gray-100 rounded text-sm hover:bg-gray-200">DOCX</button>
          <button onClick={() => handleConvert("pdf")} className="px-3 py-1 bg-gray-100 rounded text-sm hover:bg-gray-200">PDF</button>
          <a href={artifact.downloadUrl || `/api/v1/artifacts/${artifactId}/download`} className="px-4 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">Download</a>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Preview (2 cols) */}
        <div className="col-span-2 bg-white rounded-lg shadow overflow-hidden" style={{ minHeight: "500px" }}>
          <div className="bg-gray-50 px-4 py-2 border-b text-sm font-medium">Preview</div>
          <iframe srcDoc={previewContent} className="w-full" style={{ height: "600px", border: "none" }} sandbox="allow-same-origin" />
        </div>

        {/* Sidebar: Versions + Dependencies */}
        <div className="space-y-4">
          {/* Version History */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold text-sm mb-3">Version History ({versions.length})</h3>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {versions.map(v => (
                <div key={v.id}
                  className={`flex items-center justify-between py-1.5 px-2 rounded cursor-pointer text-xs ${selectedVersion === v.version ? "bg-blue-50 ring-1 ring-blue-200" : "hover:bg-gray-50"}`}
                  onClick={() => setSelectedVersion(v.version)}
                >
                  <span className="font-medium">v{v.version}</span>
                  <span className="text-gray-500">{formatBytes(v.size)}</span>
                  <span className="text-gray-400">{new Date(v.createdAt).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
            {/* Version diff selector */}
            <div className="mt-3 flex items-center gap-2 text-xs">
              <select className="border rounded px-1 py-0.5" value={diffA ?? ""} onChange={e => setDiffA(Number(e.target.value) || null)}>
                <option value="">vA</option>
                {versions.map(v => <option key={v.version} value={v.version}>v{v.version}</option>)}
              </select>
              <span>vs</span>
              <select className="border rounded px-1 py-0.5" value={diffB ?? ""} onChange={e => setDiffB(Number(e.target.value) || null)}>
                <option value="">vB</option>
                {versions.map(v => <option key={v.version} value={v.version}>v{v.version}</option>)}
              </select>
              <button disabled={!diffA || !diffB} className="px-2 py-0.5 bg-gray-100 rounded disabled:opacity-30">Compare</button>
            </div>
          </div>

          {/* Dependencies */}
          {deps && (deps.dependsOn.length > 0 || deps.dependedBy.length > 0) && (
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-semibold text-sm mb-2">Dependencies</h3>
              {deps.dependsOn.length > 0 && (
                <div className="mb-2">
                  <p className="text-xs text-gray-500 mb-1">Depends on:</p>
                  {deps.dependsOn.map(d => (
                    <a key={d.id} href={`/artifacts/${d.id}`} className="block text-xs text-blue-600 hover:underline py-0.5">{d.title} (v{d.version})</a>
                  ))}
                </div>
              )}
              {deps.dependedBy.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Depended by:</p>
                  {deps.dependedBy.map(d => (
                    <a key={d.id} href={`/artifacts/${d.id}`} className="block text-xs text-blue-600 hover:underline py-0.5">{d.title} (v{d.version})</a>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
