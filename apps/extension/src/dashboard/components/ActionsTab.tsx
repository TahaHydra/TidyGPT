import { useState } from "react";
import type { ConversationCandidate } from "@tidygpt/shared";

export function ActionsTab({ candidates, onUpdate }: { candidates: ConversationCandidate[], onUpdate: () => void }) {
  const [running, setRunning] = useState(false);
  const [typedConfirm, setTypedConfirm] = useState("");

  const archiveQueue = candidates.filter(c => c.selectedAction === "archive" || c.selectedAction === "archive_then_delete");
  const deleteQueue = candidates.filter(c => c.selectedAction === "delete" || c.selectedAction === "archive_then_delete");
  
  const hasDelete = deleteQueue.length > 0;
  const canRun = (archiveQueue.length > 0 || deleteQueue.length > 0) && (!hasDelete || typedConfirm === "CONFIRM");

  async function executeActionPlan() {
    setRunning(true);
    alert("Dry run executed. In a real scenario, this would loop over the queue and send messages to the content script using UI automation selectors.");
    setRunning(false);
  }

  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 600, margin: "0 0 24px" }}>Action Runner</h2>
      
      <div style={{ padding: 24, background: "#18181b", borderRadius: 8, border: "1px solid #27272a", maxWidth: 600 }}>
        <h3 style={{ marginTop: 0 }}>Action Plan</h3>
        <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", color: "#a1a1aa" }}>
          <li style={{ padding: "8px 0", borderBottom: "1px solid #27272a" }}>Archive: <strong style={{ color: "#fafafa" }}>{archiveQueue.length}</strong> items</li>
          <li style={{ padding: "8px 0", borderBottom: "1px solid #27272a" }}>Delete: <strong style={{ color: "#f87171" }}>{deleteQueue.length}</strong> items</li>
        </ul>

        {hasDelete && (
          <div style={{ marginBottom: 24, padding: 16, background: "#450a0a", border: "1px solid #7f1d1d", borderRadius: 6 }}>
            <h4 style={{ margin: "0 0 8px", color: "#fecaca" }}>Destructive Action Warning</h4>
            <p style={{ margin: "0 0 12px", color: "#fca5a5", fontSize: 13 }}>
              You have selected items for direct deletion. This cannot be undone. Type <strong>CONFIRM</strong> to unlock the runner.
            </p>
            <input 
              type="text" 
              value={typedConfirm} 
              onChange={e => setTypedConfirm(e.target.value)} 
              placeholder="CONFIRM"
              style={{ width: "100%", padding: 8, background: "#18181b", border: "1px solid #7f1d1d", color: "#fafafa", borderRadius: 4 }}
            />
          </div>
        )}

        <button 
          onClick={executeActionPlan}
          disabled={!canRun || running}
          style={{ width: "100%", padding: 12, background: canRun ? "#fafafa" : "#27272a", color: canRun ? "#09090b" : "#52525b", fontWeight: 600, border: "none", borderRadius: 6, cursor: canRun ? "pointer" : "not-allowed" }}
        >
          {running ? "Executing..." : "Execute Dry Run"}
        </button>
      </div>
    </div>
  );
}
