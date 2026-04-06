# Alternative Checkbox Types

**Date**: 2026-04-05
**Status**: Complete

## What was built

### Custom task markers in reader and editor
- `- [/]` — partially done (orange ◐)
- `- [-]` — cancelled (grey —, strikethrough text)
- `- [>]` — deferred (blue ▸)
- `- [!]` — important (red !)
- `- [?]` — question (purple ?)
- `- [*]` — star (yellow ★)

### Implementation
- Regex expanded from `[ xX]` to `[ xX/\->!?*]` in three locations
- Alternative markers render as colored bordered `<span>` icons (not `<input>`)
- Standard `[ ]` / `[x]` remain interactive checkboxes
- Cancelled tasks get `text-decoration: line-through` via CSS class

## Files changed
- `packages/web/src/lib/markdown.ts` — expanded task_lists core rule
- `packages/web/src/components/Reader.tsx` — expanded checkbox count regex
- `packages/web/src/components/Editor.tsx` — expanded CheckboxWidget to handle alt markers
- `packages/web/src/styles.css` — .task-cancelled strikethrough style
