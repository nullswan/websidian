# Cross-Pane Tab Drag and Drop

**Date**: 2026-04-05
**Status**: Complete

## What was built

### Drag tabs between split panes
- Previously only within-pane reorder was supported
- Now tabs can be dragged from one pane to another
- Drop on a specific tab: inserts at that position
- Drop on empty tab bar area: appends to end
- Source pane's active tab updates to nearest neighbor
- Dropped tab becomes active in target pane

## Key technical decisions
- **Reused existing dragTabRef**: Already tracked `{ tabId, paneIdx }` — just needed to handle cross-pane case
- **Dual drop targets**: Individual tab divs + tab bar container both accept drops
- **Duplicate guard**: Tab bar `onDrop` checks `dstPane.tabIds.includes()` to prevent duplicates

## Files changed
- `packages/web/src/App.tsx` — cross-pane branch in tab onDrop, tab bar onDragOver/onDrop handlers
