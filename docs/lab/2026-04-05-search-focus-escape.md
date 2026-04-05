# Search Panel Auto-Focus & Escape

**Date**: 2026-04-05
**Status**: Complete

## What was built

### Auto-focus search input
- Search input automatically receives focus when search panel mounts
- `useEffect(() => { inputRef.current?.focus(); }, [])` on mount

### Escape to return to file tree
- Pressing Escape in search input switches left panel back to file tree
- `onClose` prop passed from App.tsx: `() => setLeftPanel("files")`

## Also fixed
- Pre-existing TypeScript errors in FileTree.tsx: `entry.type === "directory"` → `entry.kind === "folder"` to match VaultEntry union type
- Missing `scrollTop: 0` in workspace restore tab construction
- Missing `paneIdx` argument in "Close tab" button for missing-file view

## Files changed
- `packages/web/src/components/SearchPanel.tsx` — auto-focus useEffect, Escape onKeyDown handler
- `packages/web/src/App.tsx` — wired `onClose` prop, fixed TS errors
- `packages/web/src/components/FileTree.tsx` — fixed VaultEntry type narrowing
