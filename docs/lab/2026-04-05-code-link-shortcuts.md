# Inline Code & Link Shortcuts

**Date**: 2026-04-05
**Status**: Complete

## What was built
- Cmd+` wraps selection with backticks for `inline code` (toggleable)
- Cmd+K inserts markdown link `[text](url)`
  - With selection: uses selected text as link text, cursor selects "url" placeholder
  - Without selection: inserts `[](url)` with cursor in brackets

## Implementation
- Inline code: reuses existing `wrapWith(view, "`")` helper
- Link: custom handler that constructs `[selected](url)` and positions cursor on "url"

## Files changed
- `packages/web/src/components/Editor.tsx` — added Mod-` and Mod-k keybindings
