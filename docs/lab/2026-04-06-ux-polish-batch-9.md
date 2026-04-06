# Lab Note: UX Polish Batch 9

**Date**: 2026-04-06
**Focus**: Graph fullscreen, file tree enhancements, editor settings, reader improvements

## Features Added

### Graph View
1. **Full-screen toggle** — expand/collapse button (⤢/⤓), Escape to exit, fixed positioning with z-index 10000

### File Tree
2. **TODO badge** — teal checkbox icon + count for notes with open `- [ ]` tasks, fetched via search API
3. **Custom sort mode** — "drag" sort mode stores manual file ordering per folder in localStorage
4. **Drag-to-reorder within folder** — drop file on sibling to reorder, auto-switches to custom sort mode

### Editor
5. **Cursor blink rate setting** — 5 presets (0/500/800/1200/2000ms) via CM6 `drawSelection({ cursorBlinkRate })` Compartment
6. **Nested callout fix** — depth-aware `blockquote_close` matching for properly nested `> > [!type]` callouts

### Reader
7. **Collapsible long code blocks** — blocks with >15 lines collapse to 240px with gradient "Show all N lines" button

### Command Palette
8. **New actions** — Insert horizontal rule, Insert code block, Insert callout, Sort lines, Reverse lines, Toggle readable line length, Toggle spell check

## Technical Notes
- `drawSelection` is CM6's 11th Compartment in the editor — replaces native browser cursor with custom-rendered one
- Nested callout fix: track `blockquote_open`/`blockquote_close` depth counter instead of finding first close
- Custom sort stores `{ [folderPath]: string[] }` in localStorage, auto-switches from any other sort mode on first drag
- TODO counts fetched from `/api/vault/search?q=- [ ]` at vault tree load, alongside backlink counts
- Collapsible code blocks use CSS `max-height` + gradient overlay button, toggling between 240px and `none`
