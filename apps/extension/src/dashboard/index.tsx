import React from 'react';
import { createRoot } from 'react-dom/client';

const Dashboard = () => {
  return (
    <div style={{ padding: '24px' }}>
      <h1>TidyGPT Dashboard</h1>
      <p>Configure rules, review candidates, and execute jobs.</p>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<Dashboard />);
