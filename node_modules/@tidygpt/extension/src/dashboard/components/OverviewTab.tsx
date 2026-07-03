import type { ConversationCandidate } from "@tidygpt/shared";

export function OverviewTab({ candidates }: { candidates: ConversationCandidate[] }) {
  const archiveCount = candidates.filter(c => c.recommendation === "archive_candidate" || c.recommendation === "strong_archive_candidate").length;
  const deleteCount = candidates.filter(c => c.recommendation === "delete_candidate").length;
  const manualCount = candidates.filter(c => c.recommendation === "manual_review").length;
  const protectedCount = candidates.filter(c => c.recommendation === "protected").length;

  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 600, margin: "0 0 24px" }}>Overview</h2>
      
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <StatCard title="Total Candidates" value={candidates.length} />
        <StatCard title="Archive Recommended" value={archiveCount} color="#60a5fa" />
        <StatCard title="Delete Recommended" value={deleteCount} color="#f87171" />
        <StatCard title="Manual Review" value={manualCount} color="#fbbf24" />
        <StatCard title="Protected" value={protectedCount} color="#34d399" />
      </div>

      <div style={{ marginTop: 32, padding: 24, background: "#18181b", borderRadius: 8, border: "1px solid #27272a" }}>
        <h3 style={{ marginTop: 0 }}>Getting Started</h3>
        <p style={{ color: "#a1a1aa", lineHeight: 1.6 }}>
          1. Go to the <strong>Scan</strong> tab to import a JSON export or start a live DOM scan.<br/>
          2. Customize your rules in the <strong>Rules</strong> tab.<br/>
          3. Review classification results in the <strong>Review</strong> tab and assign actions.<br/>
          4. Execute the cleanup safely in the <strong>Actions</strong> tab.
        </p>
      </div>
    </div>
  );
}

function StatCard({ title, value, color = "#fafafa" }: { title: string, value: number, color?: string }) {
  return (
    <div style={{ padding: 20, background: "#18181b", borderRadius: 8, border: "1px solid #27272a" }}>
      <div style={{ color: "#a1a1aa", fontSize: 13, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 32, fontWeight: 600, color }}>{value}</div>
    </div>
  );
}
