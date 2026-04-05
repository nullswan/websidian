# Extract Selection to New Note

**Date**: 2026-04-05
**Status**: Complete

## What was built

### Note extraction refactoring command
- Select text in editor, press Ctrl+Shift+N
- Prompts for new note name via window.prompt
- Creates new note with selected content via PUT /api/vault/file
- Replaces selection with [[wikilink]] to the new note
- Toast confirmation: "Extracted to NoteName"
- Listed in command palette as "Extract current selection to new note"

## Key technical decisions
- **Callback pattern**: Editor's `onExtractSelection(selectedText, replaceWith)` decouples CM6 from app logic. The `replaceWith` closure captures the CM6 dispatch context.
- **Async-safe replace**: App.tsx awaits the file creation API call before invoking `replaceWith`, ensuring the note exists before the link is inserted.
- **window.prompt**: Simplest UX for note name input. Could be upgraded to a custom modal later.

## Files changed
- `packages/web/src/components/Editor.tsx` — `onExtractSelection` prop, Mod-Shift-n keymap
- `packages/web/src/App.tsx` — wired extract handler with file creation + replaceWith callback
