import React, { useState } from 'react';
// import { ExportProvider } from '@tidygpt/providers';
// import { calculateScore, classifyScore } from '@tidygpt/core';

export default function App() {
  const [activeTab, setActiveTab] = useState('scan');

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 24px' }}>
      <header style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>TidyGPT</h1>
          <p style={{ color: 'var(--text-muted)' }}>Local analyzer and bulk manager for ChatGPT exports.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn-primary" onClick={() => setActiveTab('scan')}>Scan</button>
          <button style={{ background: 'var(--panel-border)', color: 'white' }} onClick={() => setActiveTab('review')}>Review Queue</button>
        </div>
      </header>

      <main className="glass-panel">
        {activeTab === 'scan' && <ScanTab />}
        {activeTab === 'review' && <ReviewTab />}
      </main>
    </div>
  );
}

function ScanTab() {
  return (
    <div>
      <h2 style={{ marginBottom: '24px' }}>Import Export Data</h2>
      <div style={{
        border: '2px dashed var(--panel-border)',
        borderRadius: '12px',
        padding: '60px 24px',
        textAlign: 'center',
        background: 'rgba(255,255,255,0.02)'
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📦</div>
        <h3 style={{ marginBottom: '8px' }}>Drop your ChatGPT export ZIP here</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Or select conversations.json directly</p>
        <button className="btn-primary">Browse Files</button>
      </div>
    </div>
  );
}

function ReviewTab() {
  // Mock data for display
  const mockCandidates = [
    { id: '1', title: 'Python array sorting', messages: 2, age: 45, class: 'archive_candidate' },
    { id: '2', title: 'Hello', messages: 1, age: 10, class: 'strong_archive_candidate' },
    { id: '3', title: 'Project: Acme Corp Frontend', messages: 84, age: 2, class: 'protected' },
    { id: '4', title: 'Fix css bug', messages: 6, age: 120, class: 'manual_review' },
  ];

  const getBadge = (cls: string) => {
    switch(cls) {
      case 'strong_archive_candidate': return <span className="badge badge-archive">Strong Archive</span>;
      case 'archive_candidate': return <span className="badge badge-archive">Archive</span>;
      case 'protected': return <span className="badge" style={{background:'rgba(255,255,255,0.1)'}}>Protected</span>;
      default: return <span className="badge badge-review">Review</span>;
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2>Review Candidates</h2>
        <button className="btn-danger">Execute Selected</button>
      </div>
      
      <table>
        <thead>
          <tr>
            <th><input type="checkbox" /></th>
            <th>Title</th>
            <th>Messages</th>
            <th>Age (Days)</th>
            <th>Classification</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {mockCandidates.map(c => (
            <tr key={c.id}>
              <td><input type="checkbox" /></td>
              <td style={{ fontWeight: 500 }}>{c.title}</td>
              <td style={{ color: 'var(--text-muted)' }}>{c.messages}</td>
              <td style={{ color: 'var(--text-muted)' }}>{c.age}</td>
              <td>{getBadge(c.class)}</td>
              <td>
                <select style={{ background: 'var(--bg-color)', color: 'white', border: '1px solid var(--panel-border)', padding: '6px 12px', borderRadius: '6px' }}>
                  <option value="none">Keep</option>
                  <option value="archive">Archive</option>
                  <option value="delete">Delete</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
