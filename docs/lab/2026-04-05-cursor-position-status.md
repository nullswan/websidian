# Cursor Position in Status Bar

**Date**: 2026-04-05
**Status**: Complete

## What was built
- Status bar shows "Ln X, Col Y" when editor mode is active
- Updates in real-time as cursor moves (click, typing, arrow keys)
- Right-aligned in the status bar, hidden in reader mode

## Implementation
- Added `onCursorChange?: (line: number, col: number) => void` prop to Editor
- EditorView.updateListener tracks `selectionSet` and `docChanged` events
- Cursor position computed via `state.doc.lineAt(pos)` for line number, `pos - line.from + 1` for column
- App stores `cursorPos` state, passes to StatusBar only in edit mode
- StatusBar renders "Ln X, Col Y" with `marginLeft: auto` for right alignment

## Files changed
- `packages/web/src/components/Editor.tsx` — added onCursorChange prop, cursor tracking in update listener
- `packages/web/src/components/StatusBar.tsx` — added cursorPos prop, renders Ln/Col display
- `packages/web/src/App.tsx` — added cursorPos state, wired Editor → StatusBar
