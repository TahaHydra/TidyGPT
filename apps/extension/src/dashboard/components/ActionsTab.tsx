import { useState, useEffect } from "react";
import type { ConversationCandidate, CleanerSettings } from "@tidygpt/shared";
import { defaultSettings } from "@tidygpt/shared";
import { saveJob, getSettings, getConversationBackups } from "@tidygpt/storage";

export function ActionsTab({ candidates }: { candidates: ConversationCandidate[] }) {
  const [confirmDelete, setConfirmDelete] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [dryRunReport, setDryRunReport] = useState<any>(null);
  const [settings, setSettings] = useState<CleanerSettings>(defaultSettings);
  const [auditSummary, setAuditSummary] = useState<any>(null);

  useEffect(() => {
    getSettings().then(s => setSettings({ ...defaultSettings, ...s }));
    chrome.storage.local.get(['tidygptAuditSummary']).then(data => setAuditSummary(data.tidygptAuditSummary || null));
  }, []);

  const safeCandidates = candidates.filter(c => !c.userDecision && c.recommendation !== 'protected');
  const pendingArchive = safeCandidates.filter(c => c.selectedAction === 'archive');
  const pendingDelete = safeCandidates.filter(c => c.selectedAction === 'delete');
  const pendingBoth = safeCandidates.filter(c => c.selectedAction === 'archive_then_delete');
  const blockedStaged = candidates.filter(c => c.selectedAction !== 'none' && (c.userDecision || c.recommendation === 'protected'));

  const totalActions = pendingArchive.length + pendingDelete.length + pendingBoth.length;
  
  const handleDryRun = () => {
    const report = {
      archiveCount: pendingArchive.length + pendingBoth.length,
      deleteCount: pendingDelete.length + pendingBoth.length,
      estimatedTimeMinutes: Math.ceil(((pendingArchive.length + pendingDelete.length + pendingBoth.length) * 3) / 60),
      items: [
        ...pendingArchive.map(c => ({ title: c.title, action: "Archive" })),
        ...pendingDelete.map(c => ({ title: c.title, action: "Delete" })),
        ...pendingBoth.map(c => ({ title: c.title, action: "Archive then Delete" }))
      ]
    };
    setDryRunReport(report);
  };

  const handleExecute = async () => {
    const confirmStr = settings.deleteConfirmationString || "CONFIRM";
    const destructive = [...pendingDelete, ...pendingBoth];
    if (destructive.length > 0 && confirmDelete !== confirmStr) {
      setError(`You must type "${confirmStr}" to execute deletes.`);
      return;
    }
    setError("");
    setRunning(true);
    
    const jobId = "job_" + Date.now();
    const actionQueue = [...pendingArchive, ...pendingDelete, ...pendingBoth];
    let backupCreatedAt: string | undefined;

    if (destructive.length > 0 && settings.backupBeforeDelete !== false) {
      const keys = destructive.map(c => c.providerKey || `${c.platform || "chatgpt"}:${c.id}`);
      const backups = await getConversationBackups(keys);
      const backedUp = new Set(backups.map(item => item.providerKey));
      const missing = keys.filter(key => !backedUp.has(key));
      if (missing.length > 0) {
        setError(`${missing.length} selected conversation(s) have no local content backup. Run a live content scan before deleting.`);
        setRunning(false);
        return;
      }
      backupCreatedAt = new Date().toISOString();
      const payload = {
        format: "tidygpt-backup-v1",
        createdAt: backupCreatedAt,
        conversations: backups,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `tidygpt-backup-${backupCreatedAt.replace(/[:.]/g, '-')}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    }

    // Construct and persist the CleanupJob to IDB before dispatching
    const job = {
      jobId,
      source: "live_ui" as const,
      mode: (pendingDelete.length || pendingBoth.length ? "delete" : "archive") as "archive" | "delete",
      status: "review_ready" as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      progress: 0,
      settingsSnapshot: settings,
      candidates: actionQueue,
      actionPlan: {
        archiveCount: pendingArchive.length + pendingBoth.length,
        deleteCount: pendingDelete.length + pendingBoth.length,
        blockedCount: 0,
        uncertainCount: 0,
        estimatedTimeMs: actionQueue.length * 3000,
      },
      results: [],
      errors: [],
      backupCreatedAt,
    };

    try {
      await saveJob(job);
    } catch (err: any) {
      setError("Failed to save job to local database: " + err.message);
      setRunning(false);
      return;
    }
    
    chrome.runtime.sendMessage({ 
      type: "EXECUTE_ACTION_PLAN", 
      payload: { jobId } 
    }, (res) => {
      if (!res?.ok) {
        setError(res?.error || "Failed to start job in service worker");
        setRunning(false);
      } else {
        setRunning(false);
        alert("Execution started in background. Every success, failure, and skip is recorded in History & logs.");
      }
    });
  };

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 600, margin: "0 0 6px", letterSpacing: "-0.01em" }}>4. Run the approved plan</h2>
      <p style={{ color: '#71717a', fontSize: 13, margin: '0 0 20px' }}>Only actions staged by your audit or manual Review choices appear here. Protected items are blocked again at execution time.</p>

      {auditSummary && <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 7, background: '#111827', border: '1px solid #1e3a8a', color: '#bfdbfe', fontSize: 12 }}>Latest audit: {auditSummary.total} checked · {auditSummary.archive} archive · {auditSummary.delete} delete · {auditSummary.protected} protected</div>}
      {blockedStaged.length > 0 && <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 7, background: '#1c1910', border: '1px solid #713f12', color: '#fde68a', fontSize: 12 }}>{blockedStaged.length} stale staged action(s) are now protected and will not run.</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
        <div style={{ background: "#111113", padding: 20, borderRadius: 8, border: "1px solid #1e1e21" }}>
          <div style={{ color: "#52525b", fontSize: 12, marginBottom: 8, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>To Archive</div>
          <div style={{ fontSize: 32, fontWeight: 600, color: "#60a5fa" }}>{pendingArchive.length + pendingBoth.length}</div>
        </div>
        <div style={{ background: "#111113", padding: 20, borderRadius: 8, border: "1px solid #1e1e21" }}>
          <div style={{ color: "#52525b", fontSize: 12, marginBottom: 8, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>To Delete</div>
          <div style={{ fontSize: 32, fontWeight: 600, color: "#f87171" }}>{pendingDelete.length + pendingBoth.length}</div>
        </div>
      </div>

      <div style={{ padding: 24, background: "#111113", borderRadius: 8, border: "1px solid #1e1e21", maxWidth: 600 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 600 }}>Run Queue Actions</h3>
        
        {totalActions === 0 ? (
          <p style={{ color: "#71717a", fontSize: 13 }}>No cleanup actions staged. Mark items in the <strong>Review</strong> tab first.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {(pendingDelete.length > 0 || pendingBoth.length > 0) && (
              <div style={{ padding: 16, background: "#1c1010", border: "1px solid #450a0a", borderRadius: 6 }}>
                <div style={{ color: "#fca5a5", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Warning: Permanent Deletion</div>
                <div style={{ color: "#f87171", fontSize: 12, marginBottom: 12 }}>You have selected {pendingDelete.length + pendingBoth.length} conversations for permanent deletion. A local JSON backup will be created first. Type <strong style={{ color: "#fff" }}>{settings.deleteConfirmationString || "CONFIRM"}</strong> below to authorize.</div>
                <input 
                  type="text" 
                  value={confirmDelete}
                  onChange={e => setConfirmDelete(e.target.value)}
                  placeholder={`Type ${settings.deleteConfirmationString || "CONFIRM"}`}
                  style={{ width: "100%", padding: "8px 12px", background: "#09090b", border: "1px solid #450a0a", color: "#fff", borderRadius: 4, fontSize: 13 }}
                />
              </div>
            )}
            
            {error && <div style={{ color: "#f87171", fontSize: 13, fontWeight: 500 }}>{error}</div>}

            <div style={{ display: "flex", gap: 12 }}>
              <button 
                onClick={handleDryRun}
                disabled={running}
                style={{ padding: "8px 16px", background: "#1e1e21", color: "#fff", border: "1px solid #27272a", borderRadius: 6, fontWeight: 500, fontSize: 13, cursor: "pointer", transition: "background 0.15s" }}
                onMouseEnter={e => { if(!running) e.currentTarget.style.background = "#27272a"; }}
                onMouseLeave={e => { if(!running) e.currentTarget.style.background = "#1e1e21"; }}
              >
                Dry Run Report
              </button>
              <button 
                onClick={handleExecute}
                disabled={running}
                style={{ padding: "8px 16px", background: "#fff", color: "#000", border: "none", borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: "pointer", transition: "opacity 0.15s" }}
                onMouseEnter={e => { if(!running) e.currentTarget.style.opacity = "0.9"; }}
                onMouseLeave={e => { if(!running) e.currentTarget.style.opacity = "1"; }}
              >
                {running ? "Executing..." : "Execute Queue"}
              </button>
            </div>
          </div>
        )}
      </div>

      {dryRunReport && (
        <div style={{ marginTop: 24, padding: 24, background: "#111113", borderRadius: 8, border: "1px solid #1e1e21", maxWidth: 600 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 600 }}>Dry Run Report</h3>
          <div style={{ color: "#71717a", fontSize: 13, marginBottom: 12 }}>
            Estimated Time: ~{dryRunReport.estimatedTimeMinutes} minutes based on delay settings.
          </div>
          <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid #1e1e21", borderRadius: 6, padding: "8px 12px", background: "#09090b" }}>
            <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ color: "#52525b", textAlign: "left" }}>
                  <th style={{ padding: "6px 0", fontWeight: 500 }}>Staged Title</th>
                  <th style={{ padding: "6px 0", fontWeight: 500, textAlign: "right" }}>Staged Action</th>
                </tr>
              </thead>
              <tbody>
                {dryRunReport.items.map((item: any, idx: number) => (
                  <tr key={idx} style={{ borderTop: idx > 0 ? "1px solid #1e1e21" : "none" }}>
                    <td style={{ padding: "6px 0", color: "#fafafa" }}>{item.title}</td>
                    <td style={{ padding: "6px 0", color: item.action.includes("Delete") ? "#f87171" : "#60a5fa", textAlign: "right", fontWeight: 500 }}>{item.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
