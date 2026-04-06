# Lab Note: UX Polish Batch 10

**Date**: 2026-04-06
**Focus**: Editor modes, sidebar editing, search enhancements, tab/pane improvements

## Features Added

### Editor
1. **Source mode toggle** — 3-mode cycle: Reading → Live Preview → Source → Reading. Source mode disables all widget decorations (frontmatter, images, checkboxes, inline markers, tables, math, code blocks, embeds) while keeping syntax highlighting. `</>` icon for source mode.
2. **Copy embeddable HTML** — command palette action generates self-contained dark-themed HTML snippet with inline styles for pasting into blogs/docs

### Sidebar
3. **Editable properties** — YAML frontmatter fields editable inline with click-to-edit, add property button, and delete (×) per field. Changes write back to file via regex-based line manipulation (preserves formatting)
4. **Outline position indicator** — sliding pip track on left edge of outline panel showing current reading position proportionally

### Search
5. **Saved searches** — star icon next to match count saves query, chips shown below search tips when no query, click to restore, × to remove. Max 10, persisted in localStorage

### File Tree
6. **Drag-to-move visual feedback** — custom drag ghost (cloned element at 70% opacity), drop indicator line on file items, circular drop prevention on folders
7. **Rename validation** — blocks invalid characters (`< > : " | ? * \`), names starting with dot/space, and duplicate names in same folder with toast notification

### Tab Bar
8. **Backlink count badge** — small grey pill showing backlink count next to tab name

### Keyboard Shortcuts
9. **Split pane shortcuts** — Ctrl+Alt+\ split right, Ctrl+Alt+W close split, Ctrl+Alt+1/2 focus pane

## Technical Notes
- Source mode uses conditional extension spreading: `...(sourceMode ? [] : [widgetField1, widgetField2, ...])` — editor recreates on `sourceMode` change via useEffect dependency
- Frontmatter helpers use regex-based line editing rather than YAML parser to preserve original formatting of untouched lines
- `findSiblings` recursively walks vault tree to find folder children for duplicate name validation
- Saved searches capped at 10 entries in localStorage under `saved-searches` key
- ViewMode type extended from `"edit" | "read"` to `"edit" | "read" | "source"`
