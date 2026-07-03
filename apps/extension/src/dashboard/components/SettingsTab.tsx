export function SettingsTab() {
  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 600, margin: "0 0 24px" }}>Settings</h2>
      <div style={{ padding: 24, background: "#18181b", borderRadius: 8, border: "1px solid #27272a", maxWidth: 600 }}>
        <h3 style={{ margin: "0 0 16px" }}>Privacy & Storage</h3>
        <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#d4d4d8", marginBottom: 12 }}>
          <input type="checkbox" defaultChecked /> Store full URLs locally
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#d4d4d8", marginBottom: 12 }}>
          <input type="checkbox" defaultChecked /> Store conversation titles locally
        </label>
        <p style={{ color: "#a1a1aa", fontSize: 13, marginTop: 16 }}>
          All data is strictly stored in your local browser extension storage (IndexedDB). Nothing is ever sent to a remote server.
        </p>
      </div>
    </div>
  );
}
