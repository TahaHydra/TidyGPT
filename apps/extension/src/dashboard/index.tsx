import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ReviewTab } from "./components/ReviewTab";
import { SettingsTab } from "./components/SettingsTab";
import { ScanTab } from "./components/ScanTab";
import { OverviewTab } from "./components/OverviewTab";
import { DiagnosticsTab } from "./components/DiagnosticsTab";
import { ActionsTab } from "./components/ActionsTab";
import { RulesTab } from "./components/RulesTab";
import { LogsTab } from "./components/LogsTab";
import type { ConversationCandidate } from "@tidygpt/shared";

const TABS = [
  { id: "Overview", label: "Overview", icon: "◉" },
  { id: "Scan", label: "1. Scan", icon: "⇣" },
  { id: "Rules", label: "2. Rules & audit", icon: "⚙" },
  { id: "Review", label: "3. Review", icon: "☰" },
  { id: "Actions", label: "4. Run safely", icon: "▶" },
  { id: "Logs", label: "History & logs", icon: "📋" },
  { id: "Settings", label: "Advanced settings", icon: "⊞" },
  { id: "Diagnostics", label: "Diagnostics", icon: "♺" },
];

function Dashboard() {
  const [activeTab, setActiveTab] = useState("Overview");
  const [candidates, setCandidates] = useState<ConversationCandidate[]>([]);

  async function loadData() {
    const data = await chrome.storage.local.get(["tidygptCandidates"]);
    setCandidates((data.tidygptCandidates || []) as ConversationCandidate[]);
  }

  useEffect(() => {
    loadData();
    const listener = (changes: any, area: string) => {
      if (area === 'local' && changes.tidygptCandidates) {
        setCandidates(changes.tidygptCandidates.newValue || []);
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#09090b", color: "#fafafa", fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Sidebar */}
      <aside style={{ width: 220, minWidth: 220, background: "#111113", borderRight: "1px solid #1e1e21", padding: "20px 0", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "0 20px", marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff" }}>T</div>
            <div>
              <h1 style={{ margin: 0, fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em" }}>TidyGPT</h1>
              <p style={{ margin: 0, fontSize: 11, color: "#52525b", letterSpacing: "0.02em" }}>Local Organizer</p>
            </div>
          </div>
        </div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 2, padding: "0 8px", flex: 1 }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                textAlign: "left",
                padding: "7px 12px",
                borderRadius: 6,
                cursor: "pointer",
                border: "none",
                background: activeTab === tab.id ? "#1e1e21" : "transparent",
                color: activeTab === tab.id ? "#fafafa" : "#71717a",
                fontWeight: activeTab === tab.id ? 500 : 400,
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                gap: 8,
                transition: "background 0.15s, color 0.15s",
              }}
              onMouseEnter={e => { if (activeTab !== tab.id) (e.currentTarget.style.background = "#18181b", e.currentTarget.style.color = "#a1a1aa"); }}
              onMouseLeave={e => { if (activeTab !== tab.id) (e.currentTarget.style.background = "transparent", e.currentTarget.style.color = "#71717a"); }}
            >
              <span style={{ fontSize: 14, width: 18, textAlign: "center", opacity: activeTab === tab.id ? 1 : 0.6 }}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
        <div style={{ padding: "12px 20px", borderTop: "1px solid #1e1e21" }}>
          <div style={{ fontSize: 11, color: "#3f3f46" }}>v2.1.0 · private & local</div>
        </div>
      </aside>
      
      {/* Main content */}
      <main style={{ flex: 1, padding: "28px 40px", overflowY: "auto", maxHeight: "100vh" }}>
        {activeTab === "Overview" && <OverviewTab candidates={candidates} />}
        {activeTab === "Scan" && <ScanTab onRefresh={loadData} />}
        {activeTab === "Review" && <ReviewTab candidates={candidates} onUpdate={loadData} />}
        {activeTab === "Actions" && <ActionsTab candidates={candidates} />}
        {activeTab === "Rules" && <RulesTab onAuditComplete={loadData} />}
        {activeTab === "Logs" && <LogsTab />}
        {activeTab === "Settings" && <SettingsTab />}
        {activeTab === "Diagnostics" && <DiagnosticsTab />}
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<Dashboard />);
