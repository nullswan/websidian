# Ctrl+Click Wikilink Navigation in Editor

**Date**: 2026-04-04
**Status**: Complete

## What was built
- Ctrl+Click (Cmd+Click on Mac) on `[[wikilink]]` in the editor navigates to that note
- Works with display-text links: `[[target|display]]` extracts the target
- Uses the same `handleNavigate` flow as reader view (resolves + opens/creates)

## Implementation
- Added `EditorView.domEventHandlers` with a `click` handler in Editor.tsx
- On Ctrl/Meta+Click: uses `posAtCoords` to find the cursor position in the document
- Scans the line text for `[[...]]` patterns and checks if click offset falls inside one
- Calls `onNavigate` prop with the extracted target
- `onNavigate` wired to `handleNavigate` in App.tsx (same as reader view)

## Files changed
- `packages/web/src/components/Editor.tsx` — added `onNavigate` prop, click handler extension
- `packages/web/src/App.tsx` — passed `onNavigate={handleNavigate}` to Editor
