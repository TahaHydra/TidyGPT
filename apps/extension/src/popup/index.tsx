import React from 'react';
import { createRoot } from 'react-dom/client';

const Popup = () => {
  return (
    <div>
      <h2>TidyGPT</h2>
      <button onClick={() => chrome.runtime.openOptionsPage()}>Open Dashboard</button>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<Popup />);
