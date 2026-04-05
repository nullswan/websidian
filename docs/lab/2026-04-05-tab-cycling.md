# Tab Cycling Shortcuts

**Date**: 2026-04-05
**Status**: Complete

## What was built
- Ctrl+Tab cycles to the next tab in the active pane
- Ctrl+Shift+Tab cycles to the previous tab
- Wraps around at boundaries (last → first, first → last)

## Implementation
- Added `Tab` key handler in global keyboard shortcuts in App.tsx
- Uses modular arithmetic for wrap-around: `(currentIdx + delta + length) % length`
- Updates pane's `activeTabId` directly via `setPanes`

## Files changed
- `packages/web/src/App.tsx` — added Ctrl+Tab/Ctrl+Shift+Tab handler
