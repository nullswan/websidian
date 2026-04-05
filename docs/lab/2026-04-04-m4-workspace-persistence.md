# M4 Gap: Workspace Persistence

**Date**: 2026-04-04
**Status**: Complete

## What was built

Tabs, panes, active pane, sidebar panel selection, sidebar widths, and split ratio now persist across page reloads via localStorage.

### Save (debounced 500ms)
- On any change to workspace state, a serializable snapshot is saved to `localStorage("obsidian-web-workspace")`
- Only saves after initial restore completes (prevents overwriting with empty state)
- Snapshot contains: tab entries (id, path, mode), pane structure, activePaneIdx, leftPanel, leftWidth, rightWidth, splitRatio
- File content is NOT saved (re-fetched on restore)

### Restore (on auth + tree load)
- After authentication and vault tree load, workspace is restored from localStorage
- Each tab's content, metadata, and backlinks are re-fetched from the server
- `tabIdCounter` is synced to avoid ID collisions with restored tabs
- Corrupted localStorage is silently ignored (fresh start)

### Logout
- `localStorage.removeItem("obsidian-web-workspace")` clears saved state on logout

## Verification
- Playwright screenshots before and after reload are visually identical
- Two tabs (Welcome.md + Concepts.md) survive full page navigation
- Active tab, sidebar state, and layout dimensions all preserved

## Files changed
- `packages/web/src/App.tsx` — added save effect, restore logic in tree-load callback, localStorage clear on logout
