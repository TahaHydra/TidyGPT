import { useState } from "react";

export function DiagnosticsTab() {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runDiagnostics = () => {
    setLoading(true);
    chrome.runtime.sendMessage({ type: 'RUN_DIAGNOSTICS' }, (response) => {
      setLoading(false);
      if (chrome.runtime.lastError) {
        setHealth({ error: chrome.runtime.lastError.message });
      } else {
        setHealth(response || { error: "No response from service worker" });
      }
    });
  };

  const exportDiagnostics = () => {
    if (!health) return;
    const blob = new Blob([JSON.stringify(health, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tidygpt-diagnostics-${new Date().toISOString().replace(/:/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 600, margin: "0 0 20px", letterSpacing: "-0.01em" }}>Diagnostics</h2>
      
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <button 
          onClick={runDiagnostics} 
          disabled={loading}
          style={{ padding: "8px 16px", background: "#fff", color: "#000", border: "none", borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: "pointer", transition: "opacity 0.15s" }}
          onMouseEnter={e => e.currentTarget.style.opacity = "0.9"}
          onMouseLeave={e => e.currentTarget.style.opacity = "1"}
        >
          {loading ? "Running Probes..." : "Run Probe Diagnostics"}
        </button>
        <button 
          onClick={exportDiagnostics}
          disabled={!health}
          style={{ padding: "8px 16px", background: "#1e1e21", color: "#fff", border: "1px solid #27272a", borderRadius: 6, fontWeight: 500, fontSize: 13, cursor: health ? "pointer" : "not-allowed", transition: "background 0.15s" }}
          onMouseEnter={e => { if(health) e.currentTarget.style.background = "#27272a"; }}
          onMouseLeave={e => { if(health) e.currentTarget.style.background = "#1e1e21"; }}
        >
          Export Diagnostics
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 800 }}>
        
        {/* Main Status */}
        {health && (
          <div style={{ padding: 16, background: health.error ? "#1c1010" : "#111113", border: `1px solid ${health.error ? "#450a0a" : "#1e1e21"}`, borderRadius: 8 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Probe Status Summary</h3>
            {health.error ? (
              <div style={{ color: "#f87171", fontSize: 13 }}>Failed to contact tab: {health.error}</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
                <div style={{ color: "#fafafa" }}>Target URL: <span style={{ color: "#60a5fa" }}>{health.url}</span></div>
                <div style={{ color: "#71717a" }}>All automated DOM selectors were probed. Check statuses below.</div>
              </div>
            )}
          </div>
        )}

        {/* Detailed Heuristics Grid */}
        {health && !health.error && health.health && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            <ProbeCard name="Sidebar Container" probe={health.health.sidebar} />
            <ProbeCard name="Chat Sidebar Links" probe={health.health.chatLinks} />
            <ProbeCard name="Menu Trigger Button" probe={health.health.menuTrigger} />
            <ProbeCard name="Archive Menu Item" probe={health.health.archiveAction} />
            <ProbeCard name="Delete Menu Item" probe={health.health.deleteAction} />
          </div>
        )}

        {/* Informative placeholder */}
        {!health && (
          <div style={{ padding: 32, background: "#111113", borderRadius: 8, border: "1px solid #1e1e21", textAlign: "center" }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>🔍</div>
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 4px" }}>No Diagnostic Run</h3>
            <p style={{ color: "#71717a", fontSize: 13, maxWidth: 400, margin: "0 auto" }}>
              Run diagnostics to probe selector health on chatgpt.com. This detects if OpenAI made breaking changes to their HTML classnames or structure.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ProbeCard({ name, probe }: { name: string, probe: { ok: boolean, confidence: number, found: number, warnings: string[] } }) {
  const isOk = probe.ok;
  return (
    <div style={{ padding: 16, background: "#111113", borderRadius: 8, border: "1px solid #1e1e21", borderTop: `3px solid ${isOk ? "#15803d" : "#b91c1c"}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#fafafa" }}>{name}</span>
        <span style={{ fontSize: 11, padding: "2px 6px", background: isOk ? "#052e16" : "#450a0a", color: isOk ? "#4ade80" : "#f87171", borderRadius: 4, fontWeight: 500 }}>
          {isOk ? "Healthy" : "Failed"}
        </span>
      </div>
      <div style={{ fontSize: 12, color: "#71717a", display: "flex", flexDirection: "column", gap: 4 }}>
        <div>Confidence: <strong style={{ color: "#d4d4d8" }}>{Math.floor(probe.confidence * 100)}%</strong></div>
        <div>Count Found: <strong style={{ color: "#d4d4d8" }}>{probe.found}</strong></div>
        {probe.warnings && probe.warnings.map((w, idx) => (
          <div key={idx} style={{ color: "#fca5a5", fontSize: 11, marginTop: 4 }}>⚠ {w}</div>
        ))}
      </div>
    </div>
  );
}
