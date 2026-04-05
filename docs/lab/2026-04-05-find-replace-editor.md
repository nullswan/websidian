# Find & Replace in Editor

**Date**: 2026-04-05
**Status**: Complete

## What was built
- Full find & replace panel in the CodeMirror editor
- Cmd+F (Mac) / Ctrl+F (Linux/Win) opens find panel
- Cmd+Alt+F (Mac) / Ctrl+H (Linux/Win) opens find & replace
- Features: next/previous, match case, regexp, by word, replace, replace all
- Match highlighting with orange background, current match darker
- Dark-themed panel matching the app's design

## Implementation
- Added `@codemirror/search` (already a transitive dep, now explicit)
- Imported `search()` extension and `searchKeymap`
- Added both to the EditorState extensions array
- Styled `.cm-panels`, `.cm-search`, `.cm-searchMatch`, `.cm-searchMatch-selected` in CSS

## Files changed
- `packages/web/src/components/Editor.tsx` — added search import and extensions
- `packages/web/src/styles.css` — dark theme styles for CM6 search panel
