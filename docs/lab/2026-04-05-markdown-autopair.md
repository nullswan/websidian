# Markdown Delimiter Auto-Pairing

**Date**: 2026-04-05
**Status**: Complete

## What was built

### Auto-close markdown formatting delimiters
- Typing `**` auto-closes to `****` with cursor between
- Same for `~~` (strikethrough) and `==` (highlight)
- Wraps selected text when delimiter is typed with selection active
- Works alongside existing closeBrackets for () [] {} "" ''
- Uses CM6 `EditorView.inputHandler` for clean input interception

## Key technical decisions
- **inputHandler over keydown**: Handles all input methods (keyboard, IME, paste) correctly
- **Double delimiter pattern**: Only triggers auto-close on second character (`*` + `*` = `****`)
- **Anti-triple guard**: Won't auto-close if next character is already the same delimiter

## Files changed
- `packages/web/src/components/Editor.tsx` — markdownAutoPair extension, added to extensions array
