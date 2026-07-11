import { useState, useEffect } from 'react';
import { getSettings, saveSettings } from '@tidygpt/storage';
import { defaultSettings, CleanerSettings } from '@tidygpt/shared';

const sectionStyle: React.CSSProperties = { padding: 20, background: "#111113", borderRadius: 8, border: "1px solid #1e1e21" };
const labelStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", color: "#d4d4d8", fontSize: 13, cursor: "pointer" };
const inputStyle: React.CSSProperties = { width: 70, background: '#1c1c1f', border: '1px solid #27272a', color: '#fff', borderRadius: 4, padding: '4px 8px', fontSize: 13, textAlign: "right" };
const selectStyle: React.CSSProperties = { background: '#1c1c1f', border: '1px solid #27272a', color: '#fff', borderRadius: 4, padding: '4px 8px', fontSize: 13 };

export function SettingsTab() {
  const [settings, setSettingsState] = useState<CleanerSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [keywordInput, setKeywordInput] = useState("");

  useEffect(() => {
    getSettings().then(s => {
      if (s) setSettingsState(s);
      setLoading(false);
    });
  }, []);

  const updateSettings = (updates: Partial<CleanerSettings>) => {
    const next = { ...settings, ...updates };
    setSettingsState(next);
    saveSettings(next);
  };

  const addKeyword = () => {
    const kw = keywordInput.trim();
    if (!kw) return;
    if (settings.protectedKeywords.includes(kw)) return;
    updateSettings({ protectedKeywords: [...settings.protectedKeywords, kw] });
    setKeywordInput("");
  };

  const removeKeyword = (kw: string) => {
    updateSettings({ protectedKeywords: settings.protectedKeywords.filter(k => k !== kw) });
  };

  if (loading) return <div style={{ color: "#71717a", fontSize: 13 }}>Loading settings...</div>;

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 600, margin: "0 0 20px", letterSpacing: "-0.01em" }}>Settings</h2>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 640 }}>
        
        {/* Scoring Thresholds */}
        <div style={sectionStyle}>
          <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 600 }}>Scoring Thresholds</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={labelStyle}>
              <span>Max User Messages (Short Conversation)</span>
              <input type="number" value={settings.maxUserMessages} onChange={e => updateSettings({ maxUserMessages: Number(e.target.value) })} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              <span>Max Total Messages (Short Conversation)</span>
              <input type="number" value={settings.maxTotalMessages} onChange={e => updateSettings({ maxTotalMessages: Number(e.target.value) })} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              <span>Older Than Days (Inactivity Threshold)</span>
              <input type="number" value={settings.olderThanDays} onChange={e => updateSettings({ olderThanDays: Number(e.target.value) })} style={inputStyle} />
            </label>
          </div>
        </div>

        {/* Behaviors */}
        <div style={sectionStyle}>
          <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 600 }}>Behaviors</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={labelStyle}>
              <span>Conversations with Code</span>
              <select value={settings.codeBehavior} onChange={e => updateSettings({ codeBehavior: e.target.value as any })} style={selectStyle}>
                <option value="ignore">Ignore</option>
                <option value="warn">Warn</option>
                <option value="block">Block</option>
              </select>
            </label>
            <label style={labelStyle}>
              <span>Conversations with Files</span>
              <select value={settings.fileBehavior} onChange={e => updateSettings({ fileBehavior: e.target.value as any })} style={selectStyle}>
                <option value="ignore">Ignore</option>
                <option value="warn">Warn</option>
                <option value="block">Block</option>
              </select>
            </label>
            <label style={labelStyle}>
              <span>Project Artifacts</span>
              <select value={settings.projectBehavior} onChange={e => updateSettings({ projectBehavior: e.target.value as any })} style={selectStyle}>
                <option value="ignore">Ignore</option>
                <option value="warn">Warn</option>
                <option value="block">Block</option>
              </select>
            </label>
          </div>
        </div>

        <div style={sectionStyle}>
          <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 600 }}>Live Content Scan</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={labelStyle}>
              <span>First and last messages to inspect</span>
              <input type="number" min="1" max="100" value={settings.contentScanMessageLimit ?? 20} onChange={e => updateSettings({ contentScanMessageLimit: Number(e.target.value) })} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              <span>No-progress rounds before sidebar completion</span>
              <input type="number" min="2" max="20" value={settings.deepScanIdleRounds ?? 5} onChange={e => updateSettings({ deepScanIdleRounds: Number(e.target.value) })} style={inputStyle} />
            </label>
            <label style={{ ...labelStyle, justifyContent: "flex-start", gap: 10 }}>
              <input type="checkbox" checked={settings.backupBeforeDelete !== false} onChange={e => updateSettings({ backupBeforeDelete: e.target.checked })} />
              <span>Require and download a content backup before deletion</span>
            </label>
          </div>
        </div>

        {/* Protected Keywords */}
        <div style={sectionStyle}>
          <h3 style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 600 }}>Protected Keywords</h3>
          <p style={{ color: "#71717a", fontSize: 12, margin: "0 0 14px", lineHeight: 1.4 }}>Conversations containing these keywords in their content will be marked as protected and blocked from cleanup.</p>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input 
              type="text" 
              value={keywordInput}
              onChange={e => setKeywordInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addKeyword(); }}
              placeholder="e.g. API keys, secrets, client-x"
              style={{ flex: 1, padding: "6px 10px", background: '#1c1c1f', border: '1px solid #27272a', color: '#fff', borderRadius: 4, fontSize: 13 }}
            />
            <button onClick={addKeyword} style={{ padding: "6px 14px", background: '#fff', color: '#000', border: 'none', borderRadius: 4, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Add</button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {settings.protectedKeywords.length === 0 && <span style={{ color: "#52525b", fontSize: 12 }}>No keywords configured.</span>}
            {settings.protectedKeywords.map(kw => (
              <span key={kw} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 8px", background: "#052e16", color: "#6ee7b7", border: "1px solid #064e3b", borderRadius: 4, fontSize: 12 }}>
                {kw}
                <button onClick={() => removeKeyword(kw)} style={{ background: "none", border: "none", color: "#a7f3d0", cursor: "pointer", padding: 0, fontSize: 14, lineHeight: 1, fontWeight: "bold" }}>×</button>
              </span>
            ))}
          </div>
        </div>

        {/* Safety & Confirmation */}
        <div style={sectionStyle}>
          <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 600 }}>Execution Safety</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={labelStyle}>
              <span>Min Selector Confidence Threshold</span>
              <input type="number" step="0.1" min="0.1" max="1.0" value={settings.minSelectorConfidence} onChange={e => updateSettings({ minSelectorConfidence: Number(e.target.value) })} style={inputStyle} />
            </label>
            <label style={{ ...labelStyle, justifyContent: "flex-start", gap: 10 }}>
              <input type="checkbox" checked={settings.requireReview} onChange={e => updateSettings({ requireReview: e.target.checked })} />
              <span>Require manual approval in Review tab before executing actions</span>
            </label>
            <label style={labelStyle}>
              <span>Delete Confirmation String</span>
              <input type="text" value={settings.deleteConfirmationString} onChange={e => updateSettings({ deleteConfirmationString: e.target.value })} style={{ ...inputStyle, width: 100, textAlign: "left" }} />
            </label>
          </div>
        </div>
        
      </div>
    </div>
  );
}
