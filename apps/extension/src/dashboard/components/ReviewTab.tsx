import { useState, useMemo } from "react";
import type { ConversationCandidate } from "@tidygpt/shared";

const badgeStyle = (bg: string, fg: string): React.CSSProperties => ({
  display: "inline-block", padding: "2px 8px", background: bg, color: fg, borderRadius: 4, fontSize: 11, fontWeight: 500, lineHeight: "18px",
});

const thStyle: React.CSSProperties = { padding: "10px 14px", fontWeight: 500, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" };
const tdStyle: React.CSSProperties = { padding: "10px 14px" };
const btnStyle = (active = false): React.CSSProperties => ({
  padding: "5px 12px", fontSize: 12, fontWeight: 500, background: active ? "#1e1e21" : "transparent", color: active ? "#fafafa" : "#71717a",
  border: "1px solid #27272a", borderRadius: 4, cursor: "pointer", transition: "all 0.15s",
});

export function ReviewTab({ candidates, onUpdate }: { candidates: ConversationCandidate[], onUpdate: () => void }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("score_desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filteredAndSorted = useMemo(() => {
    let result = candidates.filter(c => {
      if (filter === "archive") return c.recommendation === "archive_candidate" || c.recommendation === "strong_archive_candidate";
      if (filter === "delete") return c.recommendation === "delete_candidate";
      if (filter === "protected") return c.recommendation === "protected";
      if (filter === "review") return c.recommendation === "manual_review";
      return true;
    });

    if (search) {
      const lower = search.toLowerCase();
      result = result.filter(c => (c.title || "").toLowerCase().includes(lower) || (c.id || "").includes(lower));
    }

    return result.sort((a, b) => {
      if (sort === "score_desc") return (b.score?.total || 0) - (a.score?.total || 0);
      if (sort === "score_asc") return (a.score?.total || 0) - (b.score?.total || 0);
      if (sort === "messages_desc") return (b.counts?.totalMessages || 0) - (a.counts?.totalMessages || 0);
      return 0;
    });
  }, [candidates, filter, search, sort]);

  function toggleSelect(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function selectAll() {
    if (selected.size === filteredAndSorted.length && filteredAndSorted.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredAndSorted.map(c => c.id)));
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

  function exportCSV() {
    const rows = [
      ["ID", "Title", "URL", "Source", "UserMsgs", "AsstMsgs", "TotalMsgs", "Score", "Recommendation", "Action"]
    ];
    for (const c of filteredAndSorted) {
      if (selected.size > 0 && !selected.has(c.id)) continue;
      const title = c.title || "Untitled";
      rows.push([
        c.id, `"${title.replace(/"/g, '""')}"`, c.url || "", c.source,
        c.counts?.userMessages?.toString() || '0', c.counts?.assistantMessages?.toString() || '0',
        c.counts?.totalMessages?.toString() || '0', c.score?.total?.toString() || '0',
        c.recommendation || "unknown", c.selectedAction || 'none'
      ]);
    }
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "tidygpt_candidates.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportJSON() {
    const items = filteredAndSorted.filter(c => selected.size === 0 || selected.has(c.id));
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "tidygpt_candidates.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function getRecBadge(rec: string | undefined) {
    const r = rec || "unknown";
    if (r.includes("archive")) return badgeStyle("#172554", "#93c5fd");
    if (r === "delete_candidate") return badgeStyle("#450a0a", "#fca5a5");
    if (r === "protected") return badgeStyle("#052e16", "#6ee7b7");
    if (r === "manual_review") return badgeStyle("#422006", "#fde68a");
    return badgeStyle("#1e1e21", "#71717a");
  }

  function getActionLabel(action: string | undefined) {
    if (!action || action === "none") return "—";
    if (action === "archive") return "ARCHIVE";
    if (action === "delete") return "DELETE";
    if (action === "archive_then_delete") return "ARCH+DEL";
    return action;
  }

  return (
    <div>
      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <h2 style={{ fontSize: 22, fontWeight: 600, margin: 0, letterSpacing: "-0.01em" }}>Review Queue</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input 
            type="text" 
            placeholder="Search..." 
            value={search} 
            onChange={e => setSearch(e.target.value)}
            style={{ padding: "6px 10px", background: "#111113", color: "#fafafa", border: "1px solid #27272a", borderRadius: 4, width: 160, fontSize: 12 }}
          />
          <select value={filter} onChange={e => setFilter(e.target.value)} style={{ padding: "6px 10px", background: "#111113", color: "#fafafa", border: "1px solid #27272a", borderRadius: 4, fontSize: 12 }}>
            <option value="all">All ({candidates.length})</option>
            <option value="archive">Archive</option>
            <option value="delete">Delete</option>
            <option value="review">Manual Review</option>
            <option value="protected">Protected</option>
          </select>
          <select value={sort} onChange={e => setSort(e.target.value)} style={{ padding: "6px 10px", background: "#111113", color: "#fafafa", border: "1px solid #27272a", borderRadius: 4, fontSize: 12 }}>
            <option value="score_desc">Score ↓</option>
            <option value="score_asc">Score ↑</option>
            <option value="messages_desc">Messages ↓</option>
          </select>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ padding: "8px 14px", background: "#111113", border: "1px solid #1e1e21", borderRadius: "8px 8px 0 0", display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#52525b", minWidth: 70 }}>{selected.size} selected</span>
          <button onClick={() => bulkAction("archive")} disabled={selected.size === 0} style={btnStyle()}>Mark Archive</button>
          <button onClick={() => bulkAction("delete")} disabled={selected.size === 0} style={{ ...btnStyle(), borderColor: selected.size > 0 ? "#7f1d1d" : "#27272a", color: selected.size > 0 ? "#fca5a5" : "#71717a" }}>Mark Delete</button>
          <button onClick={() => bulkAction("none")} disabled={selected.size === 0} style={btnStyle()}>Clear</button>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={exportCSV} disabled={filteredAndSorted.length === 0} style={btnStyle()}>CSV</button>
          <button onClick={exportJSON} disabled={filteredAndSorted.length === 0} style={btnStyle()}>JSON</button>
        </div>
      </div>

      {/* Table */}
      <div style={{ border: "1px solid #1e1e21", borderTop: "none", borderRadius: "0 0 8px 8px", overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#111113", color: "#52525b", textAlign: "left" }}>
              <th style={{ ...thStyle, width: 36 }}><input type="checkbox" checked={selected.size === filteredAndSorted.length && filteredAndSorted.length > 0} onChange={selectAll} /></th>
              <th style={thStyle}>Title</th>
              <th style={thStyle}>Source</th>
              <th style={thStyle}>Msgs</th>
              <th style={thStyle}>Score</th>
              <th style={thStyle}>Class</th>
              <th style={thStyle}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSorted.map(c => (
              <tr
                key={c.id}
                style={{ borderTop: "1px solid #1e1e21", background: selected.has(c.id) ? "#141418" : "transparent", transition: "background 0.1s" }}
                onMouseEnter={e => { if (!selected.has(c.id)) e.currentTarget.style.background = "#0d0d10"; }}
                onMouseLeave={e => { if (!selected.has(c.id)) e.currentTarget.style.background = "transparent"; }}
              >
                <td style={tdStyle}>
                  <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} />
                </td>
                <td style={{ ...tdStyle, maxWidth: 280 }}>
                  <div style={{ fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 2 }}>{c.title || "Untitled"}</div>
                  <div style={{ fontSize: 11, color: "#52525b", display: "flex", gap: 8, alignItems: "center" }}>
                    <a href={c.url} target="_blank" rel="noreferrer" style={{ color: "#60a5fa", textDecoration: "none", fontSize: 11 }}>Open</a>
                    {c.riskFlags?.includes("protected_keyword") && <span style={{ color: "#f59e0b", fontSize: 10, fontWeight: 600 }}>PROTECTED</span>}
                    {c.riskFlags?.includes("current_chat") && <span style={{ color: "#a78bfa", fontSize: 10, fontWeight: 600 }}>CURRENT</span>}
                  </div>
                </td>
                <td style={{ ...tdStyle, color: "#52525b", fontSize: 12 }}>{c.source === "export" ? "Export" : c.source === "live_ui" ? "Live" : c.source}</td>
                <td style={{ ...tdStyle, color: "#71717a", fontVariantNumeric: "tabular-nums" }}>{c.counts?.totalMessages ?? '—'}</td>
                <td style={{ ...tdStyle, fontVariantNumeric: "tabular-nums", fontWeight: 600, color: (c.score?.total || 0) >= 70 ? "#f87171" : (c.score?.total || 0) >= 40 ? "#fbbf24" : "#71717a" }}>{c.score?.total ?? '—'}</td>
                <td style={tdStyle}>
                  <span style={getRecBadge(c.recommendation)}>
                    {(c.recommendation || "unknown").replace(/_/g, " ").replace("candidate", "").trim()}
                  </span>
                </td>
                <td style={{ ...tdStyle, fontWeight: 600, fontSize: 11, letterSpacing: "0.03em", color: c.selectedAction === 'delete' ? '#f87171' : c.selectedAction === 'archive' ? '#60a5fa' : c.selectedAction === 'archive_then_delete' ? '#c084fc' : '#3f3f46' }}>
                  {getActionLabel(c.selectedAction)}
                </td>
              </tr>
            ))}
            {filteredAndSorted.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#3f3f46", fontSize: 13 }}>
                  {candidates.length === 0 ? "No candidates scanned yet. Use the Scan tab to import data." : "No candidates match the current filter."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 8, fontSize: 12, color: "#3f3f46", textAlign: "right" }}>
        Showing {filteredAndSorted.length} of {candidates.length}
      </div>
    </div>
  );
}
