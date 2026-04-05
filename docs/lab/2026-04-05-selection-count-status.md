# Selection Count in Status Bar

**Date**: 2026-04-05
**Status**: Complete

## What was built
- When text is selected in the editor, status bar shows "X selected" before the cursor position
- Disappears when no text is selected (0 chars)
- Works alongside the existing "Ln X, Col Y" display

## Implementation
- Extended `onCursorChange` callback to pass `{ line, col, selectedChars }` object
- `selectedChars = Math.abs(sel.to - sel.from)` from CM6 selection range
- StatusBar conditionally renders "X selected" when `selectedChars > 0`

## Files changed
- `packages/web/src/components/Editor.tsx` — extended onCursorChange to include selectedChars
- `packages/web/src/components/StatusBar.tsx` — renders selection count
- `packages/web/src/App.tsx` — updated cursorPos type and wiring
