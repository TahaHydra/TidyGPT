import { useState, useEffect } from "react";
import { getSettings } from "@tidygpt/storage";
import { defaultSettings, CleanerSettings, CustomRule } from "@tidygpt/shared";

export function RulesTab() {
  const [settings, setSettings] = useState<CleanerSettings>(defaultSettings);
  const [rulesText, setRulesText] = useState("[]");
  const [rulesError, setRulesError] = useState("");

  useEffect(() => {
    getSettings().then(s => {
      if (s) setSettings(s);
    });
    chrome.storage.local.get(['tidygptRules']).then(data => {
      setRulesText(JSON.stringify(data.tidygptRules || [], null, 2));
    });
  }, []);

  const saveCustomRules = async () => {
    try {
      const rules = JSON.parse(rulesText) as CustomRule[];
      if (!Array.isArray(rules) || rules.some(rule => !rule.id || !rule.name || !['archive', 'delete', 'keep'].includes(rule.type))) {
        throw new Error('Rules must be an array with id, name, type, and conditions.');
      }
      await chrome.storage.local.set({ tidygptRules: rules });
      setRulesError('Saved. New rules are applied during the next content scan.');
    } catch (error: any) {
      setRulesError(error.message);
    }
  };

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 600, margin: "0 0 20px", letterSpacing: "-0.01em" }}>Rules & Filters</h2>
      
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", maxWidth: 900 }}>
        
        {/* Active Rules List */}
        <div style={{ padding: 20, background: "#111113", borderRadius: 8, border: "1px solid #1e1e21" }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600 }}>Active Scoring Rules</h3>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
            <RuleRow title="Short Conversation (Max User Messages)" val={settings.maxUserMessages} pts="+30 pts" />
            <RuleRow title="Short Conversation (Max Total Messages)" val={settings.maxTotalMessages} pts="+20 pts" />
            <RuleRow title="Inactivity Age Threshold" val={`${settings.olderThanDays} days`} pts="+15 pts" />
            <RuleRow title="Generic Title (e.g. 'New chat')" val="Yes" pts="+10 pts" />
            <RuleRow title="No Code Blocks Found" val="Yes" pts="+10 pts" />
            <RuleRow title="No Uploaded Files Found" val="Yes" pts="+10 pts" />
            <RuleRow title="No Project Artifacts Found" val="Yes" pts="+10 pts" />
          </div>
        </div>

        {/* Dynamic Rules Penalties */}
        <div style={{ padding: 20, background: "#111113", borderRadius: 8, border: "1px solid #1e1e21" }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600 }}>Behavior Rules & Penalties</h3>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
            <RuleRow title="Code Behavior" val={settings.codeBehavior.toUpperCase()} pts={settings.codeBehavior === "block" ? "-40 pts" : settings.codeBehavior === "warn" ? "-10 pts" : "0 pts"} />
            <RuleRow title="File Behavior" val={settings.fileBehavior.toUpperCase()} pts={settings.fileBehavior === "block" ? "-60 pts" : settings.fileBehavior === "warn" ? "-15 pts" : "0 pts"} />
            <RuleRow title="Project Behavior" val={settings.projectBehavior.toUpperCase()} pts={settings.projectBehavior === "block" ? "-80 pts" : settings.projectBehavior === "warn" ? "-20 pts" : "0 pts"} />
            <RuleRow title="Min Selector Confidence Required" val={`${Math.floor(settings.minSelectorConfidence * 100)}%`} pts={settings.minSelectorConfidence > 0 ? "Fail -> Block" : "0 pts"} />
            <RuleRow title="Protected Keywords Configured" val={`${settings.protectedKeywords.length} keywords`} pts="Matches -> Protected" />
          </div>
        </div>

        {/* JSON Rule Representation */}
        <div style={{ padding: 20, background: "#111113", borderRadius: 8, border: "1px solid #1e1e21", gridColumn: "span 2" }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600 }}>Raw Rules Engine Schema</h3>
          <p style={{ color: "#71717a", fontSize: 12, marginBottom: 12 }}>
            This schema represents the runtime parameters loaded into the TidyGPT scoring engine.
          </p>
          <div style={{ padding: 12, border: "1px solid #1e1e21", background: "#09090b", color: "#a1a1aa", borderRadius: 6, fontFamily: "monospace", fontSize: 11, whiteSpace: "pre-wrap", overflowX: "auto" }}>
            {JSON.stringify({
              ruleset: "tidygpt-default-v1",
              conditions: [
                { parameter: "maxUserMessages", operator: "<=", value: settings.maxUserMessages, reward: 30 },
                { parameter: "maxTotalMessages", operator: "<=", value: settings.maxTotalMessages, reward: 20 },
                { parameter: "olderThanDays", operator: ">", value: settings.olderThanDays, reward: 15 },
                { parameter: "protectedKeywords", match: "substring", action: "protect" }
              ],
              behaviors: {
                code: settings.codeBehavior,
                file: settings.fileBehavior,
                project: settings.projectBehavior
              }
            }, null, 2)}
          </div>
        </div>

        <div style={{ padding: 20, background: "#111113", borderRadius: 8, border: "1px solid #1e1e21", gridColumn: "span 2" }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 600 }}>Custom Title & Body Rules</h3>
          <p style={{ color: "#71717a", fontSize: 12, lineHeight: 1.5 }}>
            Conditions support titleContains, titleDoesNotContain, titleRegex, bodyContains, bodyDoesNotContain, bodyRegex, minContentLength, maxContentLength, age/message limits, and safety predicates. Body conditions run against the configured first and last message window.
          </p>
          <textarea value={rulesText} onChange={event => setRulesText(event.target.value)} spellCheck={false}
            style={{ width: "100%", minHeight: 220, resize: "vertical", padding: 12, boxSizing: "border-box", border: "1px solid #27272a", background: "#09090b", color: "#d4d4d8", borderRadius: 6, font: "12px/1.5 monospace" }} />
          <div style={{ marginTop: 10, display: "flex", gap: 12, alignItems: "center" }}>
            <button onClick={saveCustomRules} style={{ padding: "7px 14px", background: "#fff", color: "#000", border: 0, borderRadius: 5, fontWeight: 600, cursor: "pointer" }}>Save Rules</button>
            {rulesError && <span style={{ color: rulesError.startsWith('Saved') ? "#6ee7b7" : "#fca5a5", fontSize: 12 }}>{rulesError}</span>}
          </div>
        </div>

      </div>
    </div>
  );
}

function RuleRow({ title, val, pts }: { title: string, val: string | number, pts: string }) {
  const isPositive = pts.startsWith("+");
  const isNegative = pts.startsWith("-");
  const color = isPositive ? "#34d399" : isNegative ? "#f87171" : "#a1a1aa";
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1e1e21", paddingBottom: 6 }}>
      <span style={{ color: "#a1a1aa" }}>{title}</span>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "#71717a", fontWeight: 500 }}>{val}</span>
        <span style={{ fontWeight: 600, color, fontSize: 11 }}>{pts}</span>
      </div>
    </div>
  );
}
