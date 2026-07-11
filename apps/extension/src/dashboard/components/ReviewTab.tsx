import { useEffect, useMemo, useState } from 'react';
import type { ConversationCandidate, SavedConversationDecision } from '@tidygpt/shared';

const field: React.CSSProperties = { padding: '6px 8px', background: '#111113', color: '#fafafa', border: '1px solid #27272a', borderRadius: 5, fontSize: 12 };
const btn: React.CSSProperties = { padding: '6px 10px', background: '#1e1e21', color: '#fafafa', border: '1px solid #27272a', borderRadius: 5, cursor: 'pointer', fontSize: 12, fontWeight: 600 };
const th: React.CSSProperties = { padding: '9px 11px', color: '#71717a', fontSize: 11, textTransform: 'uppercase', whiteSpace: 'nowrap', textAlign: 'left' };
const td: React.CSSProperties = { padding: '10px 11px', borderTop: '1px solid #1e1e21', verticalAlign: 'top' };

type SortKey = 'title' | 'platform' | 'messages' | 'age' | 'recommendation' | 'action';

export function ReviewTab({ candidates, onUpdate }: { candidates: ConversationCandidate[]; onUpdate: () => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [platform, setPlatform] = useState('all');
  const [recommendation, setRecommendation] = useState('all');
  const [action, setAction] = useState('all');
  const [asset, setAsset] = useState('all');
  const [decision, setDecision] = useState('all');
  const [minMessages, setMinMessages] = useState('');
  const [maxMessages, setMaxMessages] = useState('');
  const [sort, setSort] = useState<SortKey>('messages');
  const [direction, setDirection] = useState<'asc' | 'desc'>('asc');
  const [notice, setNotice] = useState('');
  const keyOf = (candidate: ConversationCandidate) => candidate.providerKey || `${candidate.platform || 'chatgpt'}:${candidate.id}`;
  useEffect(() => setSelected(new Set()), [search, platform, recommendation, action, asset, decision, minMessages, maxMessages]);

  const rows = useMemo(() => {
    const lower = search.toLocaleLowerCase();
    const result = candidates.filter(candidate => {
      const messages = candidate.counts?.totalMessages;
      if (lower && !`${candidate.title || ''} ${candidate.id} ${(candidate.matchedRuleNames || []).join(' ')}`.toLocaleLowerCase().includes(lower)) return false;
      if (platform !== 'all' && (candidate.platform || 'chatgpt') !== platform) return false;
      if (recommendation !== 'all' && candidate.recommendation !== recommendation) return false;
      if (action !== 'all' && (candidate.selectedAction || 'none') !== action) return false;
      if (decision !== 'all' && (candidate.userDecision || 'none') !== decision) return false;
      if (minMessages && (messages == null || messages < Number(minMessages))) return false;
      if (maxMessages && (messages == null || messages > Number(maxMessages))) return false;
      if (asset === 'files' && candidate.signals.hasFile !== true) return false;
      if (asset === 'code' && candidate.signals.hasCode !== true) return false;
      if (asset === 'images' && candidate.signals.hasImage !== true) return false;
      if (asset === 'artifacts' && candidate.signals.hasArtifact !== true) return false;
      if (asset === 'none' && (candidate.signals.hasFile !== false || candidate.signals.hasCode !== false || candidate.signals.hasImage !== false || candidate.signals.hasArtifact !== false)) return false;
      return true;
    });
    const value = (candidate: ConversationCandidate) => {
      if (sort === 'title') return candidate.title || '';
      if (sort === 'platform') return candidate.platform || 'chatgpt';
      if (sort === 'messages') return candidate.counts?.totalMessages ?? Number.MAX_SAFE_INTEGER;
      if (sort === 'age') return candidate.dates?.ageDays ?? Number.MAX_SAFE_INTEGER;
      if (sort === 'recommendation') return candidate.recommendation || '';
      return candidate.selectedAction || 'none';
    };
    return result.sort((a, b) => {
      const av = value(a); const bv = value(b);
      const compared = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return direction === 'asc' ? compared : -compared;
    });
  }, [candidates, search, platform, recommendation, action, asset, decision, minMessages, maxMessages, sort, direction]);

  function sortBy(key: SortKey) {
    if (sort === key) setDirection(value => value === 'asc' ? 'desc' : 'asc');
    else { setSort(key); setDirection('asc'); }
  }

  function toggle(key: string) {
    setSelected(current => { const next = new Set(current); next.has(key) ? next.delete(key) : next.add(key); return next; });
  }

  function selectVisible() {
    const visible = rows.map(keyOf);
    setSelected(current => visible.length && visible.every(key => current.has(key)) ? new Set() : new Set(visible));
  }

  async function assignAction(nextAction: ConversationCandidate['selectedAction']) {
    let skipped = 0;
    const next = candidates.map(candidate => {
      if (!selected.has(keyOf(candidate))) return candidate;
      if (candidate.userDecision && nextAction !== 'none') { skipped++; return candidate; }
      if (nextAction === 'archive' && candidate.platform && candidate.platform !== 'chatgpt') { skipped++; return candidate; }
      return { ...candidate, selectedAction: nextAction };
    });
    await chrome.storage.local.set({ tidygptCandidates: next });
    setNotice(skipped ? `${skipped} protected or archive-unsupported item(s) were not staged.` : `Updated ${selected.size} item(s).`);
    setSelected(new Set()); onUpdate();
  }

  async function saveDecision(nextDecision: SavedConversationDecision['decision']) {
    const data = await chrome.storage.local.get(['tidygptSavedDecisions']);
    const map = new Map<string, SavedConversationDecision>(((data.tidygptSavedDecisions || []) as SavedConversationDecision[]).map(item => [item.providerKey, item]));
    const nextCandidates = candidates.map(candidate => {
      const key = keyOf(candidate);
      if (!selected.has(key)) return candidate;
      map.set(key, {
        providerKey: key, platform: candidate.platform || 'chatgpt', id: candidate.id,
        title: candidate.title, url: candidate.url, decision: nextDecision, createdAt: new Date().toISOString(),
      });
      return { ...candidate, userDecision: nextDecision, recommendation: 'protected' as const, selectedAction: 'none' as const };
    });
    await chrome.storage.local.set({ tidygptSavedDecisions: Array.from(map.values()), tidygptCandidates: nextCandidates });
    setNotice(`${selected.size} conversation(s) will be protected in every future scan.`);
    setSelected(new Set()); onUpdate();
  }

  function exportReview() {
    const items = rows.filter(candidate => !selected.size || selected.has(keyOf(candidate)));
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'tidygpt-audit-review.json'; anchor.click(); URL.revokeObjectURL(url);
  }

  const allVisibleSelected = rows.length > 0 && rows.every(candidate => selected.has(keyOf(candidate)));
  return <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
      <div><h2 style={{ fontSize: 22, margin: '0 0 5px' }}>3. Review the audit</h2><p style={{ margin: 0, color: '#71717a', fontSize: 12 }}>Filter any column, open uncertain conversations, and permanently protect anything important before execution.</p></div>
      <button onClick={exportReview} style={btn}>Export visible JSON</button>
    </div>

    <div style={{ padding: 12, background: '#111113', border: '1px solid #1e1e21', borderRadius: '8px 8px 0 0', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search title, ID, matched rule…" style={{ ...field, width: 220 }} />
      <select value={platform} onChange={event => setPlatform(event.target.value)} style={field}><option value="all">All platforms</option><option value="chatgpt">ChatGPT</option><option value="claude">Claude</option><option value="gemini">Gemini</option></select>
      <select value={recommendation} onChange={event => setRecommendation(event.target.value)} style={field}><option value="all">All classes</option><option value="protected">Protected</option><option value="delete_candidate">Delete</option><option value="strong_archive_candidate">Archive</option><option value="archive_candidate">Archive suggestion</option><option value="manual_review">Manual review</option><option value="uncertain">Uncertain</option><option value="ignore">No rule</option></select>
      <select value={action} onChange={event => setAction(event.target.value)} style={field}><option value="all">All staged actions</option><option value="none">Not staged</option><option value="archive">Archive</option><option value="delete">Delete</option></select>
      <select value={asset} onChange={event => setAsset(event.target.value)} style={field}><option value="all">Any content type</option><option value="files">Has files</option><option value="code">Has code</option><option value="images">Has images</option><option value="artifacts">Has artifacts</option><option value="none">No assets/code</option></select>
      <select value={decision} onChange={event => setDecision(event.target.value)} style={field}><option value="all">Any keep status</option><option value="keep">Permanent keep</option><option value="important">Important</option><option value="none">Not manually protected</option></select>
      <input type="number" min="0" value={minMessages} onChange={event => setMinMessages(event.target.value)} placeholder="Min msgs" style={{ ...field, width: 80 }} />
      <input type="number" min="0" value={maxMessages} onChange={event => setMaxMessages(event.target.value)} placeholder="Max msgs" style={{ ...field, width: 80 }} />
    </div>

    <div style={{ padding: 10, display: 'flex', flexWrap: 'wrap', gap: 7, alignItems: 'center', border: '1px solid #1e1e21', borderTop: 0 }}>
      <strong style={{ fontSize: 12, marginRight: 4 }}>{selected.size} selected</strong>
      <button disabled={!selected.size} onClick={() => saveDecision('keep')} style={{ ...btn, color: '#86efac' }}>Always keep</button>
      <button disabled={!selected.size} onClick={() => saveDecision('important')} style={{ ...btn, color: '#fde68a' }}>Mark important</button>
      <button disabled={!selected.size} onClick={() => assignAction('archive')} style={{ ...btn, color: '#93c5fd' }}>Stage archive</button>
      <button disabled={!selected.size} onClick={() => assignAction('delete')} style={{ ...btn, color: '#fca5a5' }}>Stage delete</button>
      <button disabled={!selected.size} onClick={() => assignAction('none')} style={btn}>Clear action</button>
      {notice && <span style={{ color: '#a7f3d0', fontSize: 12 }}>{notice}</span>}
    </div>

    <div style={{ overflow: 'auto', border: '1px solid #1e1e21', borderTop: 0, borderRadius: '0 0 8px 8px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead style={{ background: '#111113' }}><tr>
          <th style={th}><input type="checkbox" checked={allVisibleSelected} onChange={selectVisible} /></th>
          <Sortable label="Title" column="title" active={sort} direction={direction} onClick={sortBy} />
          <Sortable label="Platform" column="platform" active={sort} direction={direction} onClick={sortBy} />
          <Sortable label="Messages" column="messages" active={sort} direction={direction} onClick={sortBy} />
          <Sortable label="Age" column="age" active={sort} direction={direction} onClick={sortBy} />
          <th style={th}>Content</th><th style={th}>Matched rules</th>
          <Sortable label="Class" column="recommendation" active={sort} direction={direction} onClick={sortBy} />
          <Sortable label="Action" column="action" active={sort} direction={direction} onClick={sortBy} />
        </tr></thead>
        <tbody>{rows.map(candidate => {
          const key = keyOf(candidate);
          return <tr key={key} style={{ background: selected.has(key) ? '#15151a' : 'transparent' }}>
            <td style={td}><input type="checkbox" checked={selected.has(key)} onChange={() => toggle(key)} /></td>
            <td style={{ ...td, minWidth: 220, maxWidth: 320 }}><div style={{ fontWeight: 600 }}>{candidate.title || 'Untitled'}</div><div style={{ marginTop: 4 }}><a href={candidate.url} target="_blank" rel="noreferrer" style={{ color: '#60a5fa' }}>Open</a>{candidate.userDecision && <span style={{ marginLeft: 8, color: candidate.userDecision === 'important' ? '#fde68a' : '#86efac' }}>{candidate.userDecision.toUpperCase()}</span>}</div></td>
            <td style={td}>{candidate.platform || 'chatgpt'}</td>
            <td style={td}>{candidate.counts?.totalMessages ?? '—'}<div style={{ color: '#52525b', fontSize: 10 }}>{candidate.counts?.userMessages ?? '—'} user</div></td>
            <td style={td}>{candidate.dates?.ageDays != null ? `${candidate.dates.ageDays}d` : '—'}</td>
            <td style={{ ...td, color: '#a1a1aa', minWidth: 110 }}>{[candidate.signals.hasFile === true && 'file', candidate.signals.hasCode === true && 'code', candidate.signals.hasImage === true && 'image', candidate.signals.hasArtifact === true && 'artifact'].filter(Boolean).join(', ') || 'none detected'}</td>
            <td style={{ ...td, minWidth: 150 }}>{candidate.matchedRuleNames?.length ? candidate.matchedRuleNames.join(', ') : <span style={{ color: '#52525b' }}>No cleanup rule</span>}</td>
            <td style={{ ...td, color: candidate.recommendation === 'protected' ? '#86efac' : candidate.recommendation === 'delete_candidate' ? '#fca5a5' : '#d4d4d8' }}>{candidate.recommendation.replace(/_/g, ' ')}</td>
            <td style={{ ...td, color: candidate.selectedAction === 'delete' ? '#f87171' : candidate.selectedAction === 'archive' ? '#60a5fa' : '#71717a', fontWeight: 700 }}>{(candidate.selectedAction || 'none').toUpperCase()}</td>
          </tr>;
        })}</tbody>
      </table>
      {!rows.length && <div style={{ padding: 40, textAlign: 'center', color: '#52525b' }}>{candidates.length ? 'No conversations match these column filters.' : 'Scan conversations, then run an audit.'}</div>}
    </div>
    <div style={{ marginTop: 8, color: '#52525b', fontSize: 12, textAlign: 'right' }}>Showing {rows.length} of {candidates.length}</div>
  </div>;
}

function Sortable({ label, column, active, direction, onClick }: { label: string; column: SortKey; active: SortKey; direction: 'asc' | 'desc'; onClick: (key: SortKey) => void }) {
  return <th style={{ ...th, cursor: 'pointer' }} onClick={() => onClick(column)}>{label} {active === column ? (direction === 'asc' ? '↑' : '↓') : ''}</th>;
}
