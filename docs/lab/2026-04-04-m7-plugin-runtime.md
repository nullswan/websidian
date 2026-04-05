# M7: Plugin Runtime

**Date**: 2026-04-04
**Status**: Complete

## What was built

### Plugin manifest scanning
- `GET /api/vault/plugins` — scans `.obsidian/plugins/` directories, reads `manifest.json`, detects `main.js` presence
- `GET /api/vault/plugin-source?id=...` — serves plugin source for web-compatible plugins, rejects desktop-only plugins with 403

### Plugins sidebar panel
- Third tab in left sidebar header (Files / Search / Plugins)
- Lists all installed plugins with name, version, description, author
- Badges: "Desktop Only" (red), "Web Compatible" (purple), "No main.js" (gray), "Running" (green)

### Browser-safe plugin sandbox (`lib/plugin-sandbox.ts`)
- Executes plugin `main.js` via `new Function()` with mock `require("obsidian")`
- Mock obsidian module provides: Plugin, Notice, PluginSettingTab, Setting, Modal, MarkdownView, TFile, TFolder, Platform
- All mock methods are safe no-ops — plugins load without crashing
- Calls `onload()` after instantiation, `onunload()` on component unmount
- Desktop-only plugins are skipped; errors are caught and reported per-plugin

### Test fixtures
- `sample-plugin/` — simple web-compatible plugin with `main.js` that logs on load/unload
- `desktop-only-plugin/` — manifest with `isDesktopOnly: true`, no main.js

## Verification
- Playwright screenshot confirms both plugins visible with correct badges
- Console shows `[SamplePlugin] loaded` and `[PluginSandbox] Loaded: Sample Plugin v1.0.0`
- Desktop-only plugin correctly skipped (no "Running" badge, 403 from source endpoint)

## Files changed
- `packages/server/src/routes/vault.ts` — added `/plugin-source` endpoint
- `packages/web/src/lib/plugin-sandbox.ts` — new sandbox runtime
- `packages/web/src/components/Plugins.tsx` — updated with sandbox integration and status badges
- `docs/api.md` — documented plugin endpoints
