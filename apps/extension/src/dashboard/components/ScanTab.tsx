import { useState } from "react";
import { ExportProvider } from "@tidygpt/providers";
import type { ConversationCandidate } from "@tidygpt/shared";
import { defaultSettings } from "@tidygpt/shared";
import { getSettings } from "@tidygpt/storage";

export function ScanTab({ onRefresh }: { onRefresh: () => void }) {
  const [importing, setImporting] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  async function processJSONFile(file: File) {
    setImporting(true);
    try {
      const settings = (await getSettings()) || defaultSettings;
      const text = await file.text();
      const json = JSON.parse(text);
      
      const provider = new ExportProvider(settings);
      await provider.loadFromJSON(json);
      
      const candidates = await provider.generateCandidates();

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

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await processJSONFile(file);
  }

  function handleDrag(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processJSONFile(e.dataTransfer.files[0]);
    }
  }

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 600, margin: "0 0 20px", letterSpacing: "-0.01em" }}>Scan & Import</h2>
      
      <div style={{ display: "grid", gap: 20, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        
        {/* Live UI Scanner */}
        <div style={{ padding: 24, background: "#111113", borderRadius: 8, border: "1px solid #1e1e21", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <h3 style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 600 }}>Live UI Scanner</h3>
            <p style={{ color: "#71717a", fontSize: 13, marginBottom: 20, lineHeight: 1.5 }}>
              Scans the visible sidebar directly on chatgpt.com. To use this, open ChatGPT in an active tab, click the floating "TidyGPT Scan" button, and TidyGPT will automatically discover and classify conversations.
            </p>
          </div>
          <div style={{ padding: "12px 14px", background: "#18181b", borderRadius: 6, color: "#a1a1aa", fontSize: 12, border: "1px solid #27272a", textAlign: "center" }}>
            Requires interaction on chatgpt.com
          </div>
        </div>

        {/* Import Export */}
        <div 
          onDragEnter={handleDrag} 
          onDragOver={handleDrag} 
          onDragLeave={handleDrag} 
          onDrop={handleDrop}
          style={{ 
            padding: 24, 
            background: dragActive ? "#141418" : "#111113", 
            borderRadius: 8, 
            border: dragActive ? "1px dashed #3b82f6" : "1px solid #1e1e21", 
            display: "flex", 
            flexDirection: "column", 
            justifyContent: "space-between",
            transition: "all 0.15s"
          }}
        >
          <div>
            <h3 style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 600 }}>Import Export</h3>
            <p style={{ color: "#71717a", fontSize: 13, marginBottom: 20, lineHeight: 1.5 }}>
              Upload your official ChatGPT data export. Drag & drop or browse to import your <code style={{ color: "#a1a1aa", background: "#1c1c1f", padding: "2px 4px", borderRadius: 4, fontFamily: "monospace", fontSize: 12 }}>conversations.json</code> file.
            </p>
          </div>
          
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <label style={{
              display: "inline-block", padding: "8px 16px", background: "#fff", color: "#000",
              borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13, transition: "opacity 0.15s",
              textAlign: "center"
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = "0.9"}
            onMouseLeave={e => e.currentTarget.style.opacity = "1"}
            >
              {importing ? "Processing..." : "Select File"}
              <input type="file" accept=".json" style={{ display: "none" }} onChange={handleFileUpload} disabled={importing} />
            </label>
            <button disabled style={{ padding: "8px 16px", background: "transparent", color: "#3f3f46", border: "1px solid #1e1e21", borderRadius: 6, cursor: "not-allowed", fontSize: 13, fontWeight: 500 }}>
              ZIP Import
            </button>
          </div>
        </div>
        
      </div>
    </div>
  );
}
