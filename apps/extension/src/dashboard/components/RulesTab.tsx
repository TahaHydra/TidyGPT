export function RulesTab() {
  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 600, margin: "0 0 24px" }}>Rules & Filters</h2>
      <div style={{ padding: 24, background: "#18181b", borderRadius: 8, border: "1px solid #27272a", maxWidth: 600 }}>
        <p style={{ color: "#a1a1aa", fontSize: 14, margin: "0 0 16px" }}>
          Rules configuration is saved locally. This UI will eventually allow you to define custom JSON rules.
        </p>
        <div style={{ padding: 12, border: "1px solid #3f3f46", background: "#09090b", color: "#d4d4d8", borderRadius: 4, fontFamily: "monospace", fontSize: 12 }}>
          {`{
  "builtInSettings": {
    "maxUserMessages": 1,
    "maxTotalMessages": 3,
    "olderThanDays": 30,
    "skipCurrentChat": true,
    "codeHandling": "warn"
  }
}`}
        </div>
      </div>
    </div>
  );
}
