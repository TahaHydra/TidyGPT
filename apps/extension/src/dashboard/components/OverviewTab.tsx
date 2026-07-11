import type { ConversationCandidate } from "@tidygpt/shared";

export function OverviewTab({ candidates }: { candidates: ConversationCandidate[] }) {
  const archiveCount = candidates.filter(c => c.recommendation === "archive_candidate" || c.recommendation === "strong_archive_candidate").length;
  const deleteCount = candidates.filter(c => c.recommendation === "delete_candidate").length;
  const manualCount = candidates.filter(c => c.recommendation === "manual_review").length;
  const protectedCount = candidates.filter(c => c.recommendation === "protected").length;
  const ignoreCount = candidates.filter(c => c.recommendation === "ignore" || !c.recommendation).length;
  const pendingActions = candidates.filter(c => c.selectedAction && c.selectedAction !== "none").length;
  const chatgptCount = candidates.filter(c => (c.platform ?? "chatgpt") === "chatgpt").length;
  const claudeCount = candidates.filter(c => c.platform === "claude").length;
  const geminiCount = candidates.filter(c => c.platform === "gemini").length;

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 600, margin: "0 0 20px", letterSpacing: "-0.01em" }}>Overview</h2>
      
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 12 }}>
        <StatCard title="Total Scanned" value={candidates.length} />
        <StatCard title="Archive" value={archiveCount} color="#60a5fa" accent="#1e3a5f" />
        <StatCard title="Delete" value={deleteCount} color="#f87171" accent="#5f1e1e" />
        <StatCard title="Manual Review" value={manualCount} color="#fbbf24" accent="#5f4e1e" />
        <StatCard title="Protected" value={protectedCount} color="#34d399" accent="#1e5f3a" />
        <StatCard title="Ignored" value={ignoreCount} color="#71717a" accent="#27272a" />
      </div>

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(3, minmax(120px, 1fr))", gap: 12 }}>
        <StatCard title="ChatGPT" value={chatgptCount} color="#74aa9c" />
        <StatCard title="Claude" value={claudeCount} color="#d97757" />
        <StatCard title="Gemini" value={geminiCount} color="#8ab4f8" />
      </div>

      {pendingActions > 0 && (
        <div style={{ marginTop: 16, padding: "12px 16px", background: "#1a1a2e", border: "1px solid #27274a", borderRadius: 8, fontSize: 13, color: "#a5b4fc" }}>
          {pendingActions} conversation{pendingActions !== 1 ? "s" : ""} queued for action. Go to the <strong>Actions</strong> tab to execute.
        </div>
      )}

      <div style={{ marginTop: 24, padding: 20, background: "#111113", borderRadius: 8, border: "1px solid #1e1e21" }}>
        <h3 style={{ marginTop: 0, fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Getting Started</h3>
        <div style={{ color: "#71717a", lineHeight: 1.8, fontSize: 13 }}>
          <div style={{ display: "flex", gap: 10, marginBottom: 6 }}>
            <span style={{ color: "#3f3f46", fontWeight: 600, minWidth: 18 }}>1.</span>
            <span>Open any supported AI and use its floating scan button, or import a ChatGPT JSON export.</span>
          </div>
          <div style={{ display: "flex", gap: 10, marginBottom: 6 }}>
            <span style={{ color: "#3f3f46", fontWeight: 600, minWidth: 18 }}>2.</span>
            <span>Configure rules and thresholds in <strong style={{ color: "#a1a1aa" }}>Settings</strong>.</span>
          </div>
          <div style={{ display: "flex", gap: 10, marginBottom: 6 }}>
            <span style={{ color: "#3f3f46", fontWeight: 600, minWidth: 18 }}>3.</span>
            <span>Review candidates in the <strong style={{ color: "#a1a1aa" }}>Review</strong> tab and assign actions.</span>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <span style={{ color: "#3f3f46", fontWeight: 600, minWidth: 18 }}>4.</span>
            <span>Execute safely via the <strong style={{ color: "#a1a1aa" }}>Actions</strong> tab.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, color = "#fafafa", accent }: { title: string, value: number, color?: string, accent?: string }) {
  return (
    <div style={{ padding: "16px 18px", background: "#111113", borderRadius: 8, border: "1px solid #1e1e21", borderLeft: accent ? `3px solid ${accent}` : "1px solid #1e1e21" }}>
      <div style={{ color: "#52525b", fontSize: 12, marginBottom: 6, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>{title}</div>
      <div style={{ fontSize: 26, fontWeight: 600, color, letterSpacing: "-0.02em" }}>{value}</div>
    </div>
  );
}
