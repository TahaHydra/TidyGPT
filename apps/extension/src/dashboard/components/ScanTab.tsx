import { useState } from "react";
import { ExportProvider } from "@tidygpt/providers";
import type { ConversationCandidate } from "@tidygpt/shared";
import { classifyScore, calculateScore } from "@tidygpt/core";

export function ScanTab({ onRefresh }: { onRefresh: () => void }) {
  const [importing, setImporting] = useState(false);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      
      const provider = new ExportProvider();
      await provider.loadFromJSON(json);
      
      const rawCandidates = await provider.generateCandidates();
      
      // Apply basic scoring just as an initial pass
      const candidates = rawCandidates.map(c => {
        const score = calculateScore(c, { codeHandling: "warn" });
        return {
          ...c,
          score,
          recommendation: classifyScore(score)
        };
      });

      // Merge into storage
      const data = await chrome.storage.local.get(["tidygptCandidates"]);
      const existing = (data.tidygptCandidates || []) as ConversationCandidate[];
      const existingMap = new Map(existing.map(c => [c.id, c]));
      for (const c of candidates) {
        existingMap.set(c.id, c);
      }
      
      await chrome.storage.local.set({
        tidygptCandidates: Array.from(existingMap.values()),
        tidygptLastScanAt: new Date().toISOString()
      });
      
      onRefresh();
      alert(`Imported ${candidates.length} candidates from JSON.`);
    } catch (err: any) {
      alert("Failed to parse JSON: " + err.message);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 600, margin: "0 0 24px" }}>Scan & Import</h2>
      
      <div style={{ display: "grid", gap: 24, gridTemplateColumns: "1fr 1fr" }}>
        <div style={{ padding: 24, background: "#18181b", borderRadius: 8, border: "1px solid #27272a" }}>
          <h3 style={{ margin: "0 0 8px" }}>Live UI Scanner</h3>
          <p style={{ color: "#a1a1aa", fontSize: 14, marginBottom: 16 }}>
            Scans the visible sidebar on chatgpt.com. To use this, open ChatGPT, and click the floating "TidyGPT Scan" button.
          </p>
          <div style={{ padding: "12px 16px", background: "#27272a", borderRadius: 6, color: "#d4d4d8", fontSize: 13 }}>
            Action required on chatgpt.com
          </div>
        </div>

        <div style={{ padding: 24, background: "#18181b", borderRadius: 8, border: "1px solid #27272a" }}>
          <h3 style={{ margin: "0 0 8px" }}>Import Export</h3>
          <p style={{ color: "#a1a1aa", fontSize: 14, marginBottom: 16 }}>
            Upload your `conversations.json` from the official ChatGPT data export.
          </p>
          <label style={{
            display: "inline-block", padding: "8px 16px", background: "#fafafa", color: "#09090b",
            borderRadius: 6, cursor: "pointer", fontWeight: 500, fontSize: 14
          }}>
            {importing ? "Processing..." : "Select conversations.json"}
            <input type="file" accept=".json" style={{ display: "none" }} onChange={handleFileUpload} disabled={importing} />
          </label>
        </div>
      </div>
    </div>
  );
}
