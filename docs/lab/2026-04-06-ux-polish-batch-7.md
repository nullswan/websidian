# Lab Note: UX Polish Batch 7

**Date**: 2026-04-06
**Focus**: Content enhancements, editor productivity, visual polish

## Features Added

### Reader Enhancements
1. **Multi-column layout** — `cssclasses: multi-column` frontmatter applies CSS columns
2. **Inline link expansion** — ⊕ button on wikilinks to expand linked content inline
3. **Back-to-top button** — Floating ↑ button at 30%+ scroll

### Editor Enhancements
4. **Selection match highlight** — All occurrences highlighted on word select
5. **Smart quote replacement** — Straight quotes auto-converted to curly quotes
6. **Auto-title URL paste** — Pasting URL fetches page title async
7. **Color picker for hex codes** — Inline swatch with native picker

### Tab & Navigation
8. **Tab color labels** — 6 color options via context menu, top border indicator
9. **Reading progress per note** — localStorage persistence + file tree ring

### Graph & File Tree
10. **Graph filter depth slider** — BFS neighbor expansion control
11. **File tree sort by type** — Extension-based grouping

## Technical Notes
- Smart quotes use `EditorView.inputHandler` with preceding character context analysis
- Auto-title paste uses two-phase insert: immediate placeholder + async title replacement
- Multi-column uses native CSS `columns` with `column-span: all` on headings
- Reading progress ring in file tree reads directly from localStorage (no prop threading)
- Color picker uses hidden `<input type="color">` triggered via `.click()`
