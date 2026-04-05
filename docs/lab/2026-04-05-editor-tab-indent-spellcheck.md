# Editor Tab Indentation & Spellcheck

**Date**: 2026-04-05
**Status**: Complete

## What was built
- Tab key now indents text in the editor (instead of changing focus)
- Shift+Tab dedents
- Browser spellcheck enabled on the editor content

## Implementation
- Imported `indentWithTab` from `@codemirror/commands`
- Added to keymap array
- Added `EditorView.contentAttributes.of({ spellcheck: "true" })` for native browser spellcheck

## Files changed
- `packages/web/src/components/Editor.tsx` — added indentWithTab and spellcheck attribute
