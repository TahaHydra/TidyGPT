# TidyGPT

TidyGPT is a local-first inbox-zero tool for AI conversation history. The browser extension discovers and reviews conversations across ChatGPT, Claude, and Gemini while keeping scan data and backups on the device.

## Product capabilities

- One dashboard for ChatGPT, Claude, and Gemini histories
- Virtualization-aware sidebar discovery that stops after repeated no-progress observations rather than a fixed scroll count
- Live body inspection of the first and last configurable number of messages
- Title/body substring and regular-expression rules, age and message thresholds, and confidence-aware scoring
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

Load `apps/extension/dist` as an unpacked extension from the browser's extension management page. Open ChatGPT, Claude, or Gemini, then click the floating **TidyGPT · Scan** button. The dashboard is available from the extension popup.

The scan first walks the history list, then reads conversations sequentially in one inactive temporary tab. Keep the relevant AI account signed in until the scan completes. Review every recommendation before staging an action.

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
