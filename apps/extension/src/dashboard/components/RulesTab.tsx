import { useEffect, useState } from 'react';
import { getSettings, saveSettings } from '@tidygpt/storage';
import type {
  CleanerSettings, CustomRule, RuleConditions, SavedConversationDecision,
} from '@tidygpt/shared';
import { defaultSettings } from '@tidygpt/shared';

const card: React.CSSProperties = { padding: 20, background: '#111113', borderRadius: 9, border: '1px solid #1e1e21' };
const input: React.CSSProperties = { padding: '7px 9px', background: '#09090b', color: '#fff', border: '1px solid #27272a', borderRadius: 5, fontSize: 13 };
const button: React.CSSProperties = { padding: '8px 14px', borderRadius: 6, border: '1px solid #27272a', background: '#1e1e21', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 };

const starterRules: CustomRule[] = [
  { id: 'short-conversations', name: 'Short conversations', type: 'archive', enabled: false, conditions: { maxTotalMessages: 20 } },
  { id: 'old-conversations', name: 'Old conversations', type: 'archive', enabled: false, conditions: { olderThanDays: 90 } },
  { id: 'tiny-text', name: 'Very little text', type: 'archive', enabled: false, conditions: { maxContentLength: 500 } },
];

export function RulesTab({ onAuditComplete }: { onAuditComplete?: () => void }) {
  const [settings, setSettings] = useState<CleanerSettings>(defaultSettings);
  const [rules, setRules] = useState<CustomRule[]>(starterRules);
  const [saved, setSaved] = useState<SavedConversationDecision[]>([]);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('');
  const [auditing, setAuditing] = useState(false);
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    getSettings().then(value => setSettings({ ...defaultSettings, ...value }));
    chrome.storage.local.get(['tidygptRules', 'tidygptSavedDecisions', 'tidygptAuditSummary']).then(data => {
      if (Array.isArray(data.tidygptRules)) setRules(data.tidygptRules);
      setSaved(data.tidygptSavedDecisions || []);
      setSummary(data.tidygptAuditSummary || null);
    });
  }, []);

  function updateSettings(updates: Partial<CleanerSettings>) {
    const next = { ...settings, ...updates };
    setSettings(next);
    saveSettings(next);
  }

  function updateRule(id: string, updates: Partial<CustomRule>) {
    setRules(current => current.map(rule => rule.id === id ? { ...rule, ...updates } : rule));
  }

  function updateConditions(id: string, conditions: RuleConditions) {
    updateRule(id, { conditions });
  }

  function addRule() {
    const id = crypto.randomUUID();
    setRules(current => [...current, {
      id, name: `Rule ${current.length + 1}`, type: 'archive', enabled: true,
      conditions: { maxTotalMessages: 20 },
    }]);
  }

  async function saveRules() {
    const valid = rules.filter(rule => rule.name.trim());
    for (const rule of valid) {
      for (const [label, pattern] of [['title', rule.conditions.titleRegex], ['body', rule.conditions.bodyRegex]] as const) {
        if (!pattern) continue;
        try { new RegExp(pattern); }
        catch { setStatus(`Rule “${rule.name}” has an invalid ${label} regular expression.`); return false; }
      }
      const hasCondition = Object.values(rule.conditions).some(value => value !== undefined && value !== false && value !== '');
      if (rule.enabled !== false && !hasCondition) {
        setStatus(`Rule “${rule.name}” needs at least one filled condition.`); return false;
      }
    }
    await chrome.storage.local.set({ tidygptRules: valid });
    await saveSettings(settings);
    setRules(valid);
    setStatus('Rules saved. Run an audit to see and stage the exact result.');
    return true;
  }

  async function runAudit() {
    setAuditing(true);
    setStatus('');
    if (!await saveRules()) { setAuditing(false); return; }
    const response = await chrome.runtime.sendMessage({ type: 'RUN_RULE_AUDIT' });
    setAuditing(false);
    if (!response?.ok) {
      setStatus(`Audit failed: ${response?.error || 'unknown error'}`);
      return;
    }
    setSummary(response.summary);
    setStatus('Audit complete. Nothing has been changed online. Review the staged plan before running it.');
    onAuditComplete?.();
  }

  function addKeyword() {
    const value = keyword.trim();
    if (!value || settings.protectedKeywords.some(item => item.toLocaleLowerCase() === value.toLocaleLowerCase())) return;
    updateSettings({ protectedKeywords: [...settings.protectedKeywords, value] });
    setKeyword('');
  }

  async function removeSaved(providerKey: string) {
    const next = saved.filter(item => item.providerKey !== providerKey);
    setSaved(next);
    const data = await chrome.storage.local.get(['tidygptCandidates']);
    const candidates = (data.tidygptCandidates || []).map((candidate: any) =>
      (candidate.providerKey || `${candidate.platform || 'chatgpt'}:${candidate.id}`) === providerKey
        ? { ...candidate, userDecision: undefined, recommendation: 'uncertain', selectedAction: 'none' }
        : candidate
    );
    await chrome.storage.local.set({ tidygptSavedDecisions: next, tidygptCandidates: candidates });
  }

  return (
    <div style={{ maxWidth: 1080 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 22, margin: '0 0 6px' }}>2. Build cleanup rules</h2>
          <p style={{ color: '#71717a', fontSize: 13, margin: 0, lineHeight: 1.5 }}>Check the conditions you want. Inside one rule, every checked condition must match. Separate rules can choose separate actions.</p>
        </div>
        <button onClick={addRule} style={{ ...button, background: '#fff', color: '#000' }}>+ Add rule</button>
      </div>

      <div style={{ ...card, borderColor: '#14532d', marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 15, color: '#86efac' }}>Always protect</h3>
        <p style={{ color: '#71717a', fontSize: 12, margin: '0 0 14px' }}>These protections override every archive or delete rule, even when a cleanup rule also matches.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) minmax(280px, 1fr)', gap: 18 }}>
          <div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={keyword} onChange={event => setKeyword(event.target.value)} onKeyDown={event => event.key === 'Enter' && addKeyword()} placeholder="Word or phrase inside conversation" style={{ ...input, flex: 1 }} />
              <button onClick={addKeyword} style={button}>Add</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {settings.protectedKeywords.map(value => <span key={value} style={{ padding: '4px 8px', borderRadius: 5, background: '#052e16', color: '#86efac', fontSize: 12 }}>{value} <button onClick={() => updateSettings({ protectedKeywords: settings.protectedKeywords.filter(item => item !== value) })} style={{ border: 0, background: 'none', color: '#86efac', cursor: 'pointer' }}>×</button></span>)}
              {!settings.protectedKeywords.length && <span style={{ color: '#52525b', fontSize: 12 }}>No protected words yet.</span>}
            </div>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            <ProtectionSelect label="Conversations containing code" value={settings.codeBehavior} onChange={value => updateSettings({ codeBehavior: value })} />
            <ProtectionSelect label="Conversations containing files" value={settings.fileBehavior} onChange={value => updateSettings({ fileBehavior: value })} />
            <ProtectionSelect label="Conversations containing images" value={settings.imageBehavior} onChange={value => updateSettings({ imageBehavior: value })} />
            <ProtectionSelect label="Projects / artifacts" value={settings.projectBehavior} onChange={value => updateSettings({ projectBehavior: value })} />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 14 }}>
        {rules.map((rule, index) => (
          <RuleCard key={rule.id} rule={rule} index={index} onChange={updates => updateRule(rule.id, updates)}
            onConditions={conditions => updateConditions(rule.id, conditions)} onDelete={() => setRules(current => current.filter(item => item.id !== rule.id))} />
        ))}
        {!rules.length && <div style={{ ...card, color: '#71717a', textAlign: 'center' }}>No cleanup rules. Add one to begin.</div>}
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', margin: '18px 0' }}>
        <button onClick={saveRules} style={button}>Save rules</button>
        <button onClick={runAudit} disabled={auditing} style={{ ...button, background: '#2563eb', borderColor: '#2563eb' }}>{auditing ? 'Auditing…' : 'Run safe audit'}</button>
        {status && <span style={{ color: status.startsWith('Audit failed') ? '#fca5a5' : '#a7f3d0', fontSize: 12 }}>{status}</span>}
      </div>

      {summary && <div style={{ ...card, marginBottom: 16, borderColor: '#1e3a8a' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Latest audit — no online changes made</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(100px, 1fr))', gap: 10 }}>
          <AuditStat label="Scanned" value={summary.total} />
          <AuditStat label="Archive" value={summary.archive} color="#60a5fa" />
          <AuditStat label="Delete" value={summary.delete} color="#f87171" />
          <AuditStat label="Protected" value={summary.protected} color="#34d399" />
          <AuditStat label="No rule" value={summary.unmatched} />
        </div>
        {!!summary.missingContent && <p style={{ color: '#fde68a', fontSize: 12, margin: '12px 0 0' }}>{summary.missingContent} conversation(s) had no saved body content. Body-text rules cannot match those until a live content scan is completed.</p>}
        {!!summary.unsupportedArchive && <p style={{ color: '#fde68a', fontSize: 12, margin: '8px 0 0' }}>{summary.unsupportedArchive} Claude/Gemini archive match(es) were left for manual review because those sites do not expose an archive action.</p>}
      </div>}

      <div style={card}>
        <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>Permanent keep & important list</h3>
        <p style={{ color: '#71717a', fontSize: 12, margin: '0 0 12px' }}>Items marked in Review remain protected in every future scan until removed here.</p>
        {saved.map(item => <div key={item.providerKey} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: '1px solid #1e1e21', fontSize: 13 }}>
          <span><strong style={{ color: item.decision === 'important' ? '#fbbf24' : '#86efac' }}>{item.decision.toUpperCase()}</strong> · {item.title || item.id} <span style={{ color: '#52525b' }}>({item.platform})</span></span>
          <button onClick={() => removeSaved(item.providerKey)} style={{ ...button, padding: '5px 9px' }}>Remove protection</button>
        </div>)}
        {!saved.length && <div style={{ color: '#52525b', fontSize: 12 }}>No manually protected conversations.</div>}
      </div>
    </div>
  );
}

function RuleCard({ rule, index, onChange, onConditions, onDelete }: { rule: CustomRule; index: number; onChange: (updates: Partial<CustomRule>) => void; onConditions: (conditions: RuleConditions) => void; onDelete: () => void }) {
  const set = (key: keyof RuleConditions, value: unknown) => onConditions({ ...rule.conditions, [key]: value });
  const clear = (key: keyof RuleConditions) => {
    const next = { ...rule.conditions };
    delete next[key];
    onConditions(next);
  };
  return <div style={{ ...card, opacity: rule.enabled === false ? .65 : 1 }}>
    <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(180px, 1fr) 150px auto', gap: 10, alignItems: 'center', marginBottom: 14 }}>
      <input type="checkbox" checked={rule.enabled !== false} onChange={event => onChange({ enabled: event.target.checked })} title="Enable this rule" />
      <input value={rule.name} onChange={event => onChange({ name: event.target.value })} aria-label={`Rule ${index + 1} name`} style={{ ...input, fontWeight: 600 }} />
      <select value={rule.type} onChange={event => onChange({ type: event.target.value as CustomRule['type'] })} style={input}>
        <option value="archive">Then archive</option><option value="delete">Then delete</option><option value="keep">Then protect</option>
      </select>
      <button onClick={onDelete} style={{ ...button, padding: '7px 10px', color: '#fca5a5' }}>Remove</button>
    </div>
    <div style={{ color: '#71717a', fontSize: 11, marginBottom: 9 }}>Match ALL checked conditions:</div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(280px, 1fr))', gap: 8 }}>
      <NumberCondition label="Total messages at most" value={rule.conditions.maxTotalMessages} fallback={20} set={value => set('maxTotalMessages', value)} clear={() => clear('maxTotalMessages')} />
      <NumberCondition label="User messages at most" value={rule.conditions.maxUserMessages} fallback={10} set={value => set('maxUserMessages', value)} clear={() => clear('maxUserMessages')} />
      <NumberCondition label="Total messages at least" value={rule.conditions.minTotalMessages} fallback={20} set={value => set('minTotalMessages', value)} clear={() => clear('minTotalMessages')} />
      <NumberCondition label="User messages at least" value={rule.conditions.minUserMessages} fallback={10} set={value => set('minUserMessages', value)} clear={() => clear('minUserMessages')} />
      <NumberCondition label="Older than days" value={rule.conditions.olderThanDays} fallback={90} set={value => set('olderThanDays', value)} clear={() => clear('olderThanDays')} />
      <NumberCondition label="Conversation text characters at most" value={rule.conditions.maxContentLength} fallback={500} set={value => set('maxContentLength', value)} clear={() => clear('maxContentLength')} />
      <NumberCondition label="Conversation text characters at least" value={rule.conditions.minContentLength} fallback={5000} set={value => set('minContentLength', value)} clear={() => clear('minContentLength')} />
      <TextCondition label="Title contains" value={rule.conditions.titleContains} placeholder="draft, test…" set={value => set('titleContains', value)} clear={() => clear('titleContains')} />
      <TextCondition label="Conversation text contains" value={rule.conditions.bodyContains} placeholder="word or phrase" set={value => set('bodyContains', value)} clear={() => clear('bodyContains')} />
      <TextCondition label="Conversation text does not contain" value={rule.conditions.bodyDoesNotContain} placeholder="word or phrase" set={value => set('bodyDoesNotContain', value)} clear={() => clear('bodyDoesNotContain')} />
      <TextCondition label="Title regular expression" value={rule.conditions.titleRegex} placeholder="^(test|draft)" set={value => set('titleRegex', value)} clear={() => clear('titleRegex')} />
      <TextCondition label="Body regular expression" value={rule.conditions.bodyRegex} placeholder="pattern" set={value => set('bodyRegex', value)} clear={() => clear('bodyRegex')} />
      <FlagCondition label="Has no files" checked={!!rule.conditions.noFiles} onChange={value => value ? set('noFiles', true) : clear('noFiles')} />
      <FlagCondition label="Has no code" checked={!!rule.conditions.noCode} onChange={value => value ? set('noCode', true) : clear('noCode')} />
      <FlagCondition label="Has no images" checked={!!rule.conditions.noImages} onChange={value => value ? set('noImages', true) : clear('noImages')} />
      <FlagCondition label="Has no projects / artifacts" checked={!!rule.conditions.noArtifacts} onChange={value => value ? set('noArtifacts', true) : clear('noArtifacts')} />
    </div>
  </div>;
}

function NumberCondition({ label, value, fallback, set, clear }: { label: string; value?: number; fallback: number; set: (value: number) => void; clear: () => void }) {
  return <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}><input type="checkbox" checked={value != null} onChange={event => event.target.checked ? set(fallback) : clear()} /><span style={{ flex: 1 }}>{label}</span><input type="number" min="0" value={value ?? fallback} disabled={value == null} onChange={event => set(Number(event.target.value))} style={{ ...input, width: 90 }} /></label>;
}
function TextCondition({ label, value, placeholder, set, clear }: { label: string; value?: string; placeholder: string; set: (value: string) => void; clear: () => void }) {
  return <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}><input type="checkbox" checked={value != null} onChange={event => event.target.checked ? set('') : clear()} /><span style={{ flex: 1 }}>{label}</span><input value={value ?? ''} disabled={value == null} placeholder={placeholder} onChange={event => set(event.target.value)} style={{ ...input, width: 150 }} /></label>;
}
function FlagCondition({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}><input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} />{label}</label>;
}
function ProtectionSelect({ label, value, onChange }: { label: string; value: CleanerSettings['codeBehavior']; onChange: (value: CleanerSettings['codeBehavior']) => void }) {
  return <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, fontSize: 12 }}><span>{label}</span><select value={value} onChange={event => onChange(event.target.value as CleanerSettings['codeBehavior'])} style={input}><option value="block">Always protect</option><option value="warn">Flag for review</option><option value="ignore">Allow rules</option></select></label>;
}
function AuditStat({ label, value, color = '#d4d4d8' }: { label: string; value: number; color?: string }) {
  return <div style={{ padding: 10, background: '#09090b', borderRadius: 6 }}><div style={{ color: '#52525b', fontSize: 10, textTransform: 'uppercase' }}>{label}</div><div style={{ color, fontSize: 22, fontWeight: 700 }}>{value ?? 0}</div></div>;
}
