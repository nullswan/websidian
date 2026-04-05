# Markdown Formatting Shortcuts

**Date**: 2026-04-05
**Status**: Complete

## What was built
- Cmd+B / Ctrl+B wraps selection with `**bold**`
- Cmd+I / Ctrl+I wraps selection with `*italic*`
- Cmd+Shift+X wraps selection with `~~strikethrough~~`
- Toggle behavior: pressing again on already-wrapped text removes the markers
- Works with no selection (inserts empty markers at cursor)

## Implementation
- Created `wrapWith(view, marker)` helper inside Editor component
- Three-way logic: (1) selected text has markers inside → remove, (2) markers surround selection → remove, (3) otherwise → add
- Added to `saveKeymap` keymap with Mod-b, Mod-i, Mod-Shift-x bindings
- Uses `view.dispatch` with `selection` to keep the inner text selected after wrapping

## Files changed
- `packages/web/src/components/Editor.tsx` — added wrapWith helper and formatting keybindings
