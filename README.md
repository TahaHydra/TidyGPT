# TidyGPT

TidyGPT is a local-first inbox-zero tool for AI conversation history. The browser extension discovers and reviews conversations across ChatGPT, Claude, and Gemini while keeping scan data and backups on the device.

## Product capabilities

- One dashboard for ChatGPT, Claude, and Gemini histories
- Virtualization-aware sidebar discovery that stops after repeated no-progress observations rather than a fixed scroll count
- Live body inspection of the first and last configurable number of messages
- Plain-language rule cards with checkboxes for title/body words, regex, age, message count, text length, files, code, images, and artifacts
- A safe audit step that stages the exact archive/delete plan without changing anything online
- Permanent Keep and Important decisions that override rules in every future scan
- Review-table column filters, sortable columns, matched-rule explanations, and JSON exports
- Protected-keyword, current-chat, code, file, image, artifact, and project signals
- Mandatory review and typed confirmation for destructive actions
- Local IndexedDB content backups and a required JSON download before deletion (enabled by default)
- Dry runs, randomized throttling, execution logs, pause/cancel support, and per-platform diagnostics
- ChatGPT official `conversations.json` analysis

ChatGPT exposes native archive and delete actions. Claude and Gemini are intentionally treated as delete-only because their live products do not expose an equivalent native archive action. TidyGPT never turns an archive request into a deletion.

## Build and install

```powershell
npm install
npm test
npm run build
```

Load `apps/extension/dist` as an unpacked extension from the browser's extension management page. Open ChatGPT, Claude, or Gemini. The floating controls provide both **Scan** and **TidyGPT Dashboard** buttons, and the dashboard is also available from the extension popup.

The scan first walks the history list, then reads conversations sequentially in one inactive temporary tab. Discovery is unlimited by default and stops only after the sidebar reaches the bottom and stays unchanged for the configured number of checks. The Scan page shows the discovered count, scroll steps, completion reason, configurable delay, and optional maximum. Keep the relevant AI account signed in until the scan completes.

The intended workflow is **Scan → Rules & audit → Review → Run safely**. Rules only stage actions; they never execute them. Global protections and permanent Keep/Important decisions override cleanup rules. Review the audit before execution, and keep backup-before-delete enabled.

## Privacy and source captures

No conversation content is sent to a TidyGPT server. Candidate metadata uses extension-local storage and full pre-delete captures use extension-local IndexedDB. A deletion backup is downloaded only after an explicit execution click.

The local `pagesources/` directory is ignored by Git because captured pages may contain account or conversation information. Do not force-add it.

## Workspace

- `packages/shared` — models and settings
- `packages/core` — rules and scoring
- `packages/providers` — export and live provider interfaces
- `packages/ui-automation` — platform adapters, probes, and reviewed actions
- `packages/storage` — jobs, logs, settings, and conversation backups
- `apps/extension` — MV3 extension and unified dashboard
- `apps/cli` / `apps/local-web` — companion entry points
