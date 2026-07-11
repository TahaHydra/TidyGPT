import { useEffect, useState } from "react";
import { getAllLogs } from "@tidygpt/storage";
import type { LogEntry } from "@tidygpt/shared";

const thStyle: React.CSSProperties = { padding: "10px 14px", fontWeight: 500, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" };
const tdStyle: React.CSSProperties = { padding: "10px 14px" };

export function LogsTab() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  function loadLogs() {
    setLoading(true);
    getAllLogs().then(data => {
      setLogs(data.reverse()); // newest first
      setLoading(false);
    });
  }
  useEffect(loadLogs, []);

  const visibleLogs = logs.filter(log => {
    if (actionFilter !== 'all' && log.action !== actionFilter) return false;
    if (statusFilter !== 'all' && log.status !== statusFilter) return false;
    if (search && !`${log.details?.title || ''} ${log.details?.providerKey || ''} ${log.details?.error || ''}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())) return false;
    return true;
  });

  const exportLogs = () => {
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tidygpt-logs-${new Date().toISOString().replace(/:/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 600, margin: 0, letterSpacing: "-0.01em" }}>Action Logs</h2>
        <div style={{ display: 'flex', gap: 8 }}><button onClick={loadLogs} style={{ padding: '6px 12px', background: '#1e1e21', color: '#fafafa', border: '1px solid #27272a', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>Refresh</button><button
          onClick={exportLogs} 
          disabled={logs.length === 0} 
          style={{ 
            padding: "6px 12px", background: "#1e1e21", color: "#fafafa", border: "1px solid #27272a", borderRadius: 4, 
            cursor: logs.length ? "pointer" : "not-allowed", fontSize: 13, fontWeight: 500, transition: "background 0.15s"
          }}
          onMouseEnter={e => { if(logs.length) e.currentTarget.style.background = "#27272a"; }}
          onMouseLeave={e => { if(logs.length) e.currentTarget.style.background = "#1e1e21"; }}
        >
          Export Logs JSON
        </button></div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Filter title, ID, or error" style={{ padding: '6px 9px', width: 220, background: '#111113', color: '#fff', border: '1px solid #27272a', borderRadius: 4 }} />
        <select value={actionFilter} onChange={event => setActionFilter(event.target.value)} style={{ padding: '6px 9px', background: '#111113', color: '#fff', border: '1px solid #27272a', borderRadius: 4 }}><option value="all">All actions</option><option value="archive">Archive</option><option value="delete">Delete</option><option value="archive_then_delete">Archive then delete</option></select>
        <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} style={{ padding: '6px 9px', background: '#111113', color: '#fff', border: '1px solid #27272a', borderRadius: 4 }}><option value="all">All results</option><option value="success">Success</option><option value="failed">Failed</option><option value="skipped">Skipped</option></select>
      </div>

      <div style={{ border: "1px solid #1e1e21", borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ background: "#111113", color: "#52525b", textAlign: "left" }}>
            <tr>
              <th style={thStyle}>Time</th>
              <th style={thStyle}>Action</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Details</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{ padding: 40, textAlign: "center", color: "#71717a", fontSize: 13 }}>Loading logs...</td></tr>
            ) : visibleLogs.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: 40, textAlign: "center", color: "#3f3f46", fontSize: 13 }}>No audit logs recorded yet.</td>
              </tr>
            ) : (
              visibleLogs.map((log, idx) => (
                <tr key={log.id} style={{ borderTop: "1px solid #1e1e21", background: idx % 2 === 0 ? "#111113" : "transparent" }}>
                  <td style={{ ...tdStyle, color: "#71717a", fontVariantNumeric: "tabular-nums" }}>{new Date(log.timestamp).toLocaleString()}</td>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>
                    <span style={{ color: log.action === 'delete' ? '#f87171' : log.action === 'archive' ? '#60a5fa' : '#c084fc', fontSize: 12 }}>
                      {log.action.toUpperCase().replace(/_/g, " ")}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ 
                      display: "inline-block", padding: "2px 6px", borderRadius: 4, fontSize: 11, fontWeight: 500,
                      background: log.status === 'success' ? "#052e16" : "#450a0a", 
                      color: log.status === 'success' ? "#6ee7b7" : "#fca5a5" 
                    }}>
                      {log.status.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, color: "#fafafa" }}>
                    <div>{log.details?.title || log.details?.candidateId || "—"}</div>
                    {log.details?.error && <div style={{ color: '#fca5a5', fontSize: 11, marginTop: 3 }}>{log.details.error}</div>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
