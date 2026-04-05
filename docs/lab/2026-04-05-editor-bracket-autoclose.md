# Editor Bracket Auto-closing

**Date**: 2026-04-05
**Status**: Complete

## What was built
- Typing `(`, `[`, `{`, `` ` ``, `"`, or `'` auto-inserts the closing pair
- Cursor is placed between the pair
- Typing the closing character when cursor is before it skips over instead of inserting duplicate
- Backspace deletes both characters when between an empty pair

## Implementation
- Imported `closeBrackets` and `closeBracketsKeymap` from `@codemirror/autocomplete`
- Added `closeBrackets()` extension and keymap to EditorState

## Files changed
- `packages/web/src/components/Editor.tsx` — added closeBrackets extension and keymap
