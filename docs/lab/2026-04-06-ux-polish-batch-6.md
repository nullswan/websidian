# Lab Note: UX Polish Batch 6

**Date**: 2026-04-06
**Focus**: Reader markdown extensions, editor table tools, graph filters

## Features Added

### Reader Enhancements
1. **Blockquote citation source** — Detects "— Author" patterns, styles as right-aligned citation
2. **Definition list support** — markdown-it-deflist for `term` / `: definition` syntax
3. **Superscript/subscript** — `^sup^` and `~sub~` via markdown-it-sup/sub plugins
4. **Abbreviation tooltips** — `*[ABBR]: Full Text` renders as dotted-underline with tooltip
5. **Spoiler/blur text** — `!!hidden!!` renders blurred, click to reveal
6. **Image captions** — `![alt](url "caption")` wraps in `<figure>/<figcaption>`

### Editor Enhancements
7. **Markdown table formatter** — Shift+Alt+F aligns pipes and pads cells
8. **Table cell navigation** — Tab/Shift-Tab moves between cells, adds new row
9. **Sticky heading** — Shows current section heading stuck at top during scroll
10. **Color picker for hex codes** — Inline swatch + native color picker on click

### File Tree
11. **Sort by file type** — New extension-based sort mode in file tree cycle

### Graph View
12. **Filter depth slider** — 0-3 hop BFS expansion from filtered matches

## Technical Notes
- Sticky heading uses `position: sticky` on element prepended to CM6 `scrollDOM`
- Table navigation intercepts Tab before `indentWithTab` via keymap ordering
- Color picker uses hidden `<input type="color">` triggered programmatically
- Graph depth filter uses BFS frontier expansion from initial match set
- Spoiler uses `color: transparent` + solid background (not CSS blur filter)
