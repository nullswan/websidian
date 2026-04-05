# Named Workspace Layouts

**Date**: 2026-04-05
**Status**: Complete

## What was built

### Save/load workspace layouts
- WorkspaceManager modal with save input and workspace list
- Saves: tabs (path + mode), pane arrangement, sidebar widths, panel state
- Load restores full layout, re-fetches content from server
- Overwrite by saving with same name
- Delete with × button
- Access via command palette: "Manage workspaces"
- Stored in localStorage under `obsidian-web-workspaces`

## Key technical decisions
- **Content not cached in snapshot**: Only paths and modes are saved. Content is always fresh-fetched on load.
- **Same restore logic as workspace persistence**: Uses the same tab construction pattern as the auto-persist/restore system.
- **Simple name-based overwrite**: No confirmation dialog, matches Obsidian's workspace behavior.

## Files changed
- `packages/web/src/components/WorkspaceManager.tsx` — new modal component (~150 lines)
- `packages/web/src/App.tsx` — import, state, command palette entry, onLoad handler
