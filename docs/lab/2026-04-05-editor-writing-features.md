# Editor Writing Features

**Date**: 2026-04-05
**Status**: Complete

## What was built

### Typewriter scrolling mode
- Active line stays centered in editor while typing
- Toggle in Settings > Editor > Typewriter mode
- Uses CM6 requestMeasure for layout-safe scroll centering
- 10px dead zone to prevent jitter

### Focus mode
- Inactive lines rendered at 30% opacity
- Active line stays at full brightness
- Smooth 0.15s opacity transition
- Toggle in Settings > Editor > Focus mode
- Pure CSS via CM6 EditorView.theme()

### Unsaved changes indicator
- Purple dot (●) on tab name when content has pending changes
- Cleared when auto-save completes successfully
- onDirty callback from Editor on docChanged

### Folder file count
- Recursive file count badge next to folder names in file tree
- Subtle gray number aligned right

### Slash commands
- Type / at start of line for autocomplete dropdown
- 16 commands: headings, lists, code, callout, table, HR, math, link, image, embed
- Reuses CM6 autocompletion infrastructure

### Extract selection to new note
- Ctrl+Shift+N with selected text
- Prompts for note name, creates file, replaces selection with [[wikilink]]

## Key technical decisions
- **7 CM6 Compartments**: fontSize, spellCheck, lineNumbers, tabSize, indentUnit, typewriter, focusMode — all hot-swappable
- **Callback-based extract**: `onExtractSelection(text, replaceWith)` keeps Editor decoupled from App
- **Slash completion reuses autocompletion**: No custom dropdown, just another CompletionSource

## Files changed
- `packages/web/src/components/Editor.tsx` — typewriter, focus, onDirty, extract, slash commands
- `packages/web/src/components/Settings.tsx` — typewriterMode, focusMode toggles
- `packages/web/src/components/FileTree.tsx` — countFiles helper, badge display
- `packages/web/src/App.tsx` — wired all new props and features
