# Drag to Reorder Tabs

**Date**: 2026-04-05
**Status**: Complete

## What was built
- Tabs can be reordered within a pane by dragging and dropping
- Native HTML5 drag-and-drop, no library dependency
- Reorder persists via existing workspace localStorage save

## Implementation
- Added `dragTabRef` (useRef) to track source tab ID and pane index during drag
- Each tab div has `draggable` attribute plus `onDragStart`, `onDragOver`, `onDrop`, `onDragEnd`
- `onDragOver` calls `preventDefault()` to allow drop
- `onDrop` reorders the `tabIds` array using splice (remove from old index, insert at new index)
- Only allows reordering within the same pane (cross-pane drag ignored)

## Files changed
- `packages/web/src/App.tsx` — added dragTabRef, drag event handlers on tab elements
