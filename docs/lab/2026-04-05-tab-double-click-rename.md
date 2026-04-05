# Double-Click Tab to Rename

**Date**: 2026-04-05
**Status**: Complete

## What was built
- Double-clicking a tab name turns it into an inline editable input
- Enter or blur commits the rename via /api/vault/rename
- Escape cancels the rename
- File extension (.md) is preserved — user only edits the base name
- Toast notification on successful rename
- Tab path updated in-place without closing/reopening

## Implementation
- Added `renamingTabId` state to track which tab is being renamed
- Tab name `<span>` has `onDoubleClick` that sets `renamingTabId`
- When `renamingTabId === tab.id`, renders `<input>` with autoFocus and defaultValue
- onBlur handler: validates name, calls rename API, updates tab path, refreshes tree
- onKeyDown: Enter → blur (commit), Escape → cancel

## Files changed
- `packages/web/src/App.tsx` — added renamingTabId state, inline rename input in tab rendering
