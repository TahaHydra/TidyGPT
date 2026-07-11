import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

function Popup() {
  const [count, setCount] = useState(0);
  const [lastScanAt, setLastScanAt] = useState<string | null>(null);
  const [health, setHealth] = useState<string>("Unknown");

  async function load() {
    const data = await chrome.storage.local.get(["tidygptCandidates", "tidygptLastScanAt"]);
    setCount((data.tidygptCandidates ?? []).length);
    setLastScanAt(data.tidygptLastScanAt ?? null);
    
    // Check content script health by pinging active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id && /(^|\.)((chatgpt\.com)|(chat\.openai\.com)|(claude\.ai)|(gemini\.google\.com))$/i.test(new URL(tabs[0].url || 'https://invalid.local').hostname)) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'PING' }, (response) => {
          if (chrome.runtime.lastError) {
            setHealth("Script not loaded");
          } else if (response?.ok) {
            setHealth("Connected");
          }
        });
      } else {
        setHealth("Open a supported AI");
      }
    });
  }

  async function openDashboard() {
    chrome.runtime.openOptionsPage();
  }
  
  async function clearQueue() {
    if (confirm("Are you sure you want to clear all discovered candidates?")) {
      await chrome.storage.local.remove(["tidygptCandidates", "tidygptLastScanAt"]);
      load();
    }
  }

  useEffect(() => {
    load();
  }, []);

  const isConnected = health === "Connected";
  const statusColor = isConnected ? "#34d399" : "#f87171";
  const statusBg = isConnected ? "#052e16" : "#450a0a";
  const statusBorder = isConnected ? "#064e3b" : "#7f1d1d";

  return (
    <main style={{ width: 320, padding: 18, fontFamily: "Inter, system-ui, sans-serif", background: "#09090b", color: "#fafafa" }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 22, height: 22, borderRadius: 5, background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff" }}>T</div>
          <h1 style={{ margin: 0, fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em" }}>TidyGPT</h1>
        </div>
        <div style={{ fontSize: 11, color: statusColor, border: `1px solid ${statusBorder}`, padding: "2px 6px", borderRadius: 4, background: statusBg, fontWeight: 500 }}>
          {health}
        </div>
      </header>
      
      <div style={{ background: "#111113", borderRadius: 8, padding: "14px 16px", marginBottom: 16, border: "1px solid #1e1e21" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
          <span style={{ color: "#71717a" }}>Candidates</span>
          <span style={{ fontWeight: 600, color: "#fafafa" }}>{count}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
          <span style={{ color: "#71717a" }}>Last Scan</span>
          <span style={{ fontSize: 12, color: "#a1a1aa" }}>{lastScanAt ? new Date(lastScanAt).toLocaleTimeString() : "Never"}</span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <button
          onClick={openDashboard}
          style={{ width: "100%", padding: "8px", borderRadius: 6, border: "none", background: "#fff", color: "#000", cursor: "pointer", fontWeight: 600, fontSize: 13, transition: "opacity 0.15s" }}
          onMouseEnter={e => e.currentTarget.style.opacity = "0.9"}
          onMouseLeave={e => e.currentTarget.style.opacity = "1"}
        >
          Open Dashboard
        </button>
        <button
          onClick={clearQueue}
          style={{ width: "100%", padding: "8px", borderRadius: 6, border: "1px solid #27272a", background: "transparent", color: "#71717a", cursor: "pointer", fontWeight: 500, fontSize: 13, transition: "color 0.15s, border-color 0.15s" }}
          onMouseEnter={e => { e.currentTarget.style.color = "#fafafa"; e.currentTarget.style.borderColor = "#3f3f46"; }}
          onMouseLeave={e => { e.currentTarget.style.color = "#71717a"; e.currentTarget.style.borderColor = "#27272a"; }}
        >
          Clear Queue
        </button>
      </div>

      <p style={{ margin: "14px 0 0", color: "#3f3f46", fontSize: 11, textAlign: "center", lineHeight: 1.4 }}>
        {!isConnected ? "Open ChatGPT, Claude, or Gemini to start scanning." : "Use the floating TidyGPT button to scan this platform."}
      </p>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Popup />);
