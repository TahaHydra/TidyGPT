import { useEffect, useState } from "react";
import { ExportProvider } from "@tidygpt/providers";
import type { CleanerSettings, ConversationCandidate } from "@tidygpt/shared";
import { defaultSettings } from "@tidygpt/shared";
import { getSettings, saveConversationBackup, saveSettings } from "@tidygpt/storage";

export function ScanTab({ onRefresh }: { onRefresh: () => void }) {
  const [importing, setImporting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [progress, setProgress] = useState<any>(null);
  const [discovery, setDiscovery] = useState<any>(null);
  const [settings, setSettings] = useState<CleanerSettings>(defaultSettings);

  useEffect(() => {
    chrome.storage.local.get(['tidygptScanProgress', 'tidygptDiscoveryProgress']).then(data => {
      setProgress(data.tidygptScanProgress);
      setDiscovery(data.tidygptDiscoveryProgress);
    });
    getSettings().then(value => setSettings({ ...defaultSettings, ...value }));
    const listener = (changes: any, area: string) => {
      if (area === 'local' && changes.tidygptScanProgress) setProgress(changes.tidygptScanProgress.newValue);
      if (area === 'local' && changes.tidygptDiscoveryProgress) setDiscovery(changes.tidygptDiscoveryProgress.newValue);
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  function updateScanSettings(updates: Partial<CleanerSettings>) {
    const next = { ...settings, ...updates };
    setSettings(next);
    saveSettings(next);
  }

  async function stopContentScan() {
    const response = await chrome.runtime.sendMessage({ type: 'CANCEL_CONTENT_SCAN' });
    if (!response?.ok) alert(response?.error || 'Could not stop scan');
  }

  async function processJSONFile(file: File) {
    setImporting(true);
    try {
      const settings = (await getSettings()) || defaultSettings;
      const text = await file.text();
      const json = JSON.parse(text);
      
      const provider = new ExportProvider(settings);
      await provider.loadFromJSON(json);
      
      const candidates = await provider.generateCandidates();
      const backups = await provider.generateBackups();
      await Promise.all(backups.map(backup => saveConversationBackup(backup)));
      for (const candidate of candidates) candidate.backupAvailable = true;

      // Merge into storage
      const data = await chrome.storage.local.get(["tidygptCandidates"]);
      const existing = (data.tidygptCandidates || []) as ConversationCandidate[];
      const existingMap = new Map(existing.map(c => [c.providerKey || `${c.platform || "chatgpt"}:${c.id}`, c]));
      for (const c of candidates) {
        existingMap.set(c.providerKey || `${c.platform || "chatgpt"}:${c.id}`, c);
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
      
      {progress && progress.status !== 'idle' && (
        <div style={{ marginBottom: 18, padding: "12px 16px", background: "#111827", border: "1px solid #1e3a5f", borderRadius: 8, color: "#bfdbfe", fontSize: 13 }}>
          {progress.platform?.toUpperCase()} content scan: {progress.status}
          {typeof progress.total === 'number' && ` · ${progress.completed ?? 0}/${progress.total}`}
          {progress.waitMs ? ` · waiting ${Math.ceil(progress.waitMs / 1000)}s` : ''}
          {progress.retry ? ` · retry ${progress.retry}/${progress.maxRetries}` : ''}
          {progress.error && <span style={{ color: "#fca5a5" }}> · {progress.error}</span>}
          {['scanning', 'rate_limit_cooldown', 'batch_cooldown'].includes(progress.status) && <button onClick={stopContentScan} style={{ marginLeft: 12, padding: '4px 9px', borderRadius: 4, border: '1px solid #7f1d1d', background: '#450a0a', color: '#fca5a5', cursor: 'pointer' }}>Stop scan</button>}
        </div>
      )}
      {discovery && (
        <div style={{ marginBottom: 18, padding: "12px 16px", background: "#102018", border: "1px solid #14532d", borderRadius: 8, color: "#bbf7d0", fontSize: 13 }}>
          Sidebar discovery: <strong>{discovery.found ?? 0} found</strong> · {discovery.status}
          {discovery.rounds ? ` · ${discovery.rounds} scroll steps` : ''}
          {discovery.bottomIdleRounds != null ? ` · bottom stable ${discovery.bottomIdleRounds}/${discovery.idleRounds}` : ''}
          {discovery.reason === 'maximum_reached' && <span style={{ color: '#fde68a' }}> · stopped at your configured maximum</span>}
          {discovery.reason === 'scroll_page_limit_reached' && <span style={{ color: '#fde68a' }}> · stopped after {discovery.scrollPages} configured page scrolls</span>}
          {discovery.reason === 'sidebar_complete' && <span> · sidebar reached and stayed stable</span>}
        </div>
      )}
      <div style={{ display: "grid", gap: 20, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        
        {/* Live UI Scanner */}
        <div style={{ padding: 24, background: "#111113", borderRadius: 8, border: "1px solid #1e1e21", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <h3 style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 600 }}>Safe sidebar discovery</h3>
            <p style={{ color: "#71717a", fontSize: 13, marginBottom: 20, lineHeight: 1.5 }}>
              Open ChatGPT, Claude, or Gemini and click its floating TidyGPT button. This step reads only visible sidebar titles and URLs. It never opens conversation pages. Rules & audit will calculate any deeper reading needed and ask for approval first.
            </p>
          </div>
          <div style={{ padding: "12px 14px", background: "#18181b", borderRadius: 6, color: "#a1a1aa", fontSize: 12, border: "1px solid #27272a", textAlign: "center" }}>
            ChatGPT · Claude · Gemini
          </div>
        </div>

        <div style={{ padding: 24, background: "#111113", borderRadius: 8, border: "1px solid #1e1e21" }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 600 }}>How far should discovery scroll?</h3>
          <p style={{ color: "#71717a", fontSize: 12, lineHeight: 1.5, margin: "0 0 16px" }}>
            The default is 5 sidebar page scrolls. Set page scrolls to 0 only when you intentionally want unlimited discovery.
          </p>
          <div style={{ display: 'grid', gap: 12 }}>
            <ScanField label="Maximum sidebar page scrolls (0 = unlimited)" value={settings.deepScanMaxScrollPages ?? 5} min={0} max={10000} onChange={value => updateScanSettings({ deepScanMaxScrollPages: value })} />
            <ScanField label="Maximum conversations (0 = unlimited)" value={settings.deepScanMaxConversations ?? 0} min={0} max={100000} onChange={value => updateScanSettings({ deepScanMaxConversations: value })} />
            <ScanField label="Stable checks at the bottom" value={settings.deepScanIdleRounds ?? 10} min={2} max={50} onChange={value => updateScanSettings({ deepScanIdleRounds: value })} />
            <ScanField label="Wait after each scroll (milliseconds)" value={settings.deepScanStepDelayMs ?? 650} min={250} max={5000} step={50} onChange={value => updateScanSettings({ deepScanStepDelayMs: value })} />
            <ScanField label="Messages read from first + last" value={settings.contentScanMessageLimit ?? 20} min={1} max={100} onChange={value => updateScanSettings({ contentScanMessageLimit: value })} />
          </div>
        </div>

        <div style={{ padding: 24, background: "#111113", borderRadius: 8, border: "1px solid #1e1e21" }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 600 }}>Request pacing</h3>
          <p style={{ color: "#71717a", fontSize: 12, lineHeight: 1.5, margin: "0 0 16px" }}>These conservative defaults prevent “too many requests” warnings. Rate-limit pages trigger automatic 30s, 60s, then 120s retries.</p>
          <div style={{ display: 'grid', gap: 12 }}>
            <ScanField label="Minimum delay between conversations (seconds)" value={(settings.contentScanDelayMinMs ?? 4000) / 1000} min={1} max={120} onChange={value => updateScanSettings({ contentScanDelayMinMs: value * 1000 })} />
            <ScanField label="Maximum delay between conversations (seconds)" value={(settings.contentScanDelayMaxMs ?? 7000) / 1000} min={1} max={120} onChange={value => updateScanSettings({ contentScanDelayMaxMs: value * 1000 })} />
            <ScanField label="Conversations per batch" value={settings.contentScanBatchSize ?? 20} min={1} max={100} onChange={value => updateScanSettings({ contentScanBatchSize: value })} />
            <ScanField label="Cooldown after each batch (seconds)" value={(settings.contentScanBatchCooldownMs ?? 30000) / 1000} min={0} max={600} onChange={value => updateScanSettings({ contentScanBatchCooldownMs: value * 1000 })} />
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

function ScanField({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void }) {
  return (
    <label style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', color: '#d4d4d8', fontSize: 13 }}>
      <span>{label}</span>
      <input type="number" value={value} min={min} max={max} step={step} onChange={event => onChange(Number(event.target.value))}
        style={{ width: 92, padding: '6px 8px', background: '#09090b', color: '#fff', border: '1px solid #27272a', borderRadius: 5, textAlign: 'right' }} />
    </label>
  );
}
