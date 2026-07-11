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
              <div style={{ color: "#71717a", fontSize: 13 }}>Checked every open supported platform tab. Closed platforms are reported without failing the others.</div>
            )}
          </div>
        )}

        {/* Detailed Heuristics Grid */}
        {Array.isArray(health) && health.map((result: any) => (
          <div key={result.platform || result.url} style={{ padding: 16, background: "#111113", border: "1px solid #1e1e21", borderRadius: 8 }}>
            <h3 style={{ margin: "0 0 10px", textTransform: "capitalize", fontSize: 14 }}>{result.platform || 'Platform'} {result.url && <span style={{ color: "#52525b", fontWeight: 400 }}>· {result.url}</span>}</h3>
            {result.error ? <div style={{ color: "#f87171", fontSize: 12 }}>{result.error}</div> : result.health && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                <ProbeCard name="Sidebar" probe={result.health.sidebar} />
                <ProbeCard name="Conversation Links" probe={result.health.chatLinks} />
                <ProbeCard name="Action Menu" probe={result.health.menuTrigger} />
                <ProbeCard name="Delete Action" probe={result.health.deleteAction} />
              </div>
            )}
          </div>
        ))}

        {/* Informative placeholder */}
        {!health && (
          <div style={{ padding: 32, background: "#111113", borderRadius: 8, border: "1px solid #1e1e21", textAlign: "center" }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>🔍</div>
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 4px" }}>No Diagnostic Run</h3>
            <p style={{ color: "#71717a", fontSize: 13, maxWidth: 400, margin: "0 auto" }}>
              Run diagnostics to probe selector health on every open ChatGPT, Claude, and Gemini tab.
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
