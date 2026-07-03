import { useState, useMemo } from "react";
import type { ConversationCandidate } from "@tidygpt/shared";

export function ReviewTab({ candidates, onUpdate }: { candidates: ConversationCandidate[], onUpdate: () => void }) {
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    return candidates.filter(c => {
      if (filter === "archive") return c.recommendation === "archive_candidate" || c.recommendation === "strong_archive_candidate";
      if (filter === "delete") return c.recommendation === "delete_candidate";
      if (filter === "protected") return c.recommendation === "protected";
      if (filter === "review") return c.recommendation === "manual_review";
      return true;
    });
  }, [candidates, filter]);

  function toggleSelect(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function selectAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(c => c.id)));
    }
  }

  async function bulkAction(action: "archive" | "delete" | "archive_then_delete" | "none") {
    const data = await chrome.storage.local.get(["tidygptCandidates"]);
    const existing = (data.tidygptCandidates || []) as ConversationCandidate[];
    
    for (const c of existing) {
      if (selected.has(c.id)) {
        c.selectedAction = action;
      }
    }
    
    await chrome.storage.local.set({ tidygptCandidates: existing });
    setSelected(new Set());
    onUpdate();
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>Review Queue</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <select value={filter} onChange={e => setFilter(e.target.value)} style={{ padding: "6px 12px", background: "#18181b", color: "#fafafa", border: "1px solid #27272a", borderRadius: 4 }}>
            <option value="all">All ({candidates.length})</option>
            <option value="archive">Archive Recommended</option>
            <option value="delete">Delete Recommended</option>
            <option value="review">Manual Review</option>
            <option value="protected">Protected</option>
          </select>
        </div>
      </div>

      <div style={{ padding: 12, background: "#18181b", border: "1px solid #27272a", borderRadius: "8px 8px 0 0", display: "flex", gap: 12, alignItems: "center" }}>
        <span style={{ fontSize: 13, color: "#a1a1aa" }}>{selected.size} selected</span>
        <button onClick={() => bulkAction("archive")} disabled={selected.size === 0} style={{ padding: "4px 12px", fontSize: 13, background: "#27272a", color: "#fafafa", border: "1px solid #3f3f46", borderRadius: 4, cursor: "pointer" }}>Mark Archive</button>
        <button onClick={() => bulkAction("delete")} disabled={selected.size === 0} style={{ padding: "4px 12px", fontSize: 13, background: "#450a0a", color: "#fca5a5", border: "1px solid #7f1d1d", borderRadius: 4, cursor: "pointer" }}>Mark Delete</button>
        <button onClick={() => bulkAction("none")} disabled={selected.size === 0} style={{ padding: "4px 12px", fontSize: 13, background: "transparent", color: "#a1a1aa", border: "1px solid #3f3f46", borderRadius: 4, cursor: "pointer" }}>Clear Action</button>
      </div>

      <div style={{ border: "1px solid #27272a", borderTop: "none", borderRadius: "0 0 8px 8px", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ background: "#18181b", color: "#a1a1aa", textAlign: "left" }}>
            <tr>
              <th style={{ padding: "12px 16px", width: 40 }}><input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={selectAll} /></th>
              <th style={{ padding: "12px 16px" }}>Title</th>
              <th style={{ padding: "12px 16px" }}>Source</th>
              <th style={{ padding: "12px 16px" }}>Messages</th>
              <th style={{ padding: "12px 16px" }}>Score</th>
              <th style={{ padding: "12px 16px" }}>Class</th>
              <th style={{ padding: "12px 16px" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id} style={{ borderTop: "1px solid #27272a", background: selected.has(c.id) ? "#18181b" : "transparent" }}>
                <td style={{ padding: "12px 16px" }}>
                  <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} />
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <div style={{ fontWeight: 500 }}>{c.title}</div>
                  <div style={{ fontSize: 11, color: "#a1a1aa", marginTop: 4 }}>
                    <a href={c.url} target="_blank" rel="noreferrer" style={{ color: "#60a5fa", textDecoration: "none" }}>Open</a>
                  </div>
                </td>
                <td style={{ padding: "12px 16px", color: "#a1a1aa" }}>{c.source}</td>
                <td style={{ padding: "12px 16px", color: "#a1a1aa" }}>{c.counts?.totalMessages ?? '?'}</td>
                <td style={{ padding: "12px 16px", color: "#a1a1aa" }}>{c.score?.total ?? '?'}</td>
                <td style={{ padding: "12px 16px" }}>
                  <span style={{ padding: "2px 6px", background: "#27272a", borderRadius: 4, fontSize: 11 }}>{c.recommendation}</span>
                </td>
                <td style={{ padding: "12px 16px", fontWeight: 500, color: c.selectedAction === 'delete' ? '#f87171' : c.selectedAction === 'archive' ? '#60a5fa' : '#a1a1aa' }}>
                  {c.selectedAction}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: 32, textAlign: "center", color: "#a1a1aa" }}>No candidates found matching this filter.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
