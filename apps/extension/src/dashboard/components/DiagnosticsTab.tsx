import { useEffect, useState } from "react";
import { DomSidebarProvider } from "@tidygpt/providers";

export function DiagnosticsTab() {
  const [health, setHealth] = useState<any>(null);

  useEffect(() => {
    // In extension dashboard, we can't easily run DomSidebarProvider healthCheck directly on the ChatGPT DOM
    // without injecting a script. But we can stub the UI to show the expected diagnostic structure.
    setHealth({
      contentScriptLoaded: "Unknown (Requires chatgpt.com ping)",
      domSelectors: {
        sidebar: "Untested",
        archiveAction: "Untested",
        deleteAction: "Untested"
      }
    });
  }, []);

  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 600, margin: "0 0 24px" }}>Diagnostics</h2>
      <div style={{ padding: 24, background: "#18181b", borderRadius: 8, border: "1px solid #27272a", maxWidth: 600 }}>
        <h3 style={{ margin: "0 0 16px" }}>System Health</h3>
        <pre style={{ padding: 16, background: "#09090b", color: "#a1a1aa", borderRadius: 6, fontSize: 13 }}>
          {JSON.stringify(health, null, 2)}
        </pre>
      </div>
    </div>
  );
}
