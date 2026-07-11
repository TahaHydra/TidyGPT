import { useEffect, useState } from 'react';
import { getSettings, saveSettings } from '@tidygpt/storage';
import type { CleanerSettings } from '@tidygpt/shared';
import { defaultSettings } from '@tidygpt/shared';

const section: React.CSSProperties = { padding: 20, background: '#111113', borderRadius: 8, border: '1px solid #1e1e21' };
const row: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, color: '#d4d4d8', fontSize: 13 };
const input: React.CSSProperties = { width: 100, padding: '6px 8px', background: '#09090b', color: '#fff', border: '1px solid #27272a', borderRadius: 5, textAlign: 'right' };

export function SettingsTab() {
  const [settings, setSettings] = useState<CleanerSettings>(defaultSettings);
  useEffect(() => { getSettings().then(value => setSettings({ ...defaultSettings, ...value })); }, []);
  function update(updates: Partial<CleanerSettings>) {
    const next = { ...settings, ...updates }; setSettings(next); saveSettings(next);
  }
  return <div style={{ maxWidth: 720 }}>
    <h2 style={{ fontSize: 22, margin: '0 0 6px' }}>Advanced settings</h2>
    <p style={{ color: '#71717a', fontSize: 13, margin: '0 0 20px' }}>Normal cleanup choices live in Rules & audit. These controls tune scanning reliability and execution safety.</p>
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={section}><h3 style={{ margin: '0 0 6px', fontSize: 14 }}>Sidebar discovery</h3><p style={{ color: '#71717a', fontSize: 12, margin: '0 0 14px' }}>Zero maximum means unlimited. The scanner stops only after reaching a stable bottom.</p><div style={{ display: 'grid', gap: 11 }}>
        <NumberRow label="Maximum conversations (0 = unlimited)" value={settings.deepScanMaxConversations ?? 0} min={0} max={100000} onChange={value => update({ deepScanMaxConversations: value })} />
        <NumberRow label="Stable bottom checks" value={settings.deepScanIdleRounds ?? 10} min={2} max={50} onChange={value => update({ deepScanIdleRounds: value })} />
        <NumberRow label="Scroll wait in milliseconds" value={settings.deepScanStepDelayMs ?? 650} min={250} max={5000} onChange={value => update({ deepScanStepDelayMs: value })} />
        <NumberRow label="First and last messages sampled" value={settings.contentScanMessageLimit ?? 20} min={1} max={100} onChange={value => update({ contentScanMessageLimit: value })} />
      </div></div>
      <div style={section}><h3 style={{ margin: '0 0 14px', fontSize: 14 }}>Deletion safety</h3><div style={{ display: 'grid', gap: 11 }}>
        <CheckRow label="Require and download backup before deletion" checked={settings.backupBeforeDelete !== false} onChange={value => update({ backupBeforeDelete: value })} />
        <CheckRow label="Require staging in Review before execution" checked={settings.requireReview} onChange={value => update({ requireReview: value })} />
        <label style={row}><span>Delete confirmation phrase</span><input value={settings.deleteConfirmationString} onChange={event => update({ deleteConfirmationString: event.target.value })} style={{ ...input, textAlign: 'left' }} /></label>
        <label style={row}><span>Minimum selector confidence</span><input type="number" step="0.05" min="0.1" max="1" value={settings.minSelectorConfidence} onChange={event => update({ minSelectorConfidence: Number(event.target.value) })} style={input} /></label>
      </div></div>
      <div style={section}><h3 style={{ margin: '0 0 14px', fontSize: 14 }}>Action pacing</h3><div style={{ display: 'grid', gap: 11 }}>
        <NumberRow label="Minimum delay between actions (ms)" value={settings.delayMinMs} min={500} max={60000} onChange={value => update({ delayMinMs: value })} />
        <NumberRow label="Maximum delay between actions (ms)" value={settings.delayMaxMs} min={500} max={60000} onChange={value => update({ delayMaxMs: value })} />
      </div></div>
    </div>
  </div>;
}

function NumberRow({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return <label style={row}><span>{label}</span><input type="number" value={value} min={min} max={max} onChange={event => onChange(Number(event.target.value))} style={input} /></label>;
}
function CheckRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label style={{ ...row, justifyContent: 'flex-start' }}><input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} /><span>{label}</span></label>;
}
