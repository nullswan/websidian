# Lab Note: UX Polish Batch 8

**Date**: 2026-04-06
**Focus**: Editor keybindings, reader enhancements, status bar, search

## Features Added

### Status Bar
1. **Link count display** — internal/external link counts shown in status bar
2. **Word count sparkline** — tiny SVG trend line from localStorage history (last 20 saves)

### Editor Enhancements
3. **Footnote hover preview** — hovering [^id] shows definition text in floating tooltip
4. **Line-type gutter markers** — colored dots for headings (purple), links (blue), tasks (green), code (yellow)
5. **Show whitespace toggle** — Settings option using CM6 highlightWhitespace() Compartment
6. **Ctrl+Shift+K delete line** — standard delete-line shortcut
7. **Ctrl+L select line** — successive presses extend selection to next line

### Reader Enhancements
8. **Sortable tables** — click header to sort rows asc/desc, ▲/▼ indicator
9. **Per-heading reading time** — small "Xm" badge next to headings with 20+ words
10. **Word frequency panel** — right sidebar section with top 10 words + bar chart

### File Tree
11. **"Open all notes" folder action** — context menu opens all .md files (max 20) in tabs

### Search
12. **File type filter** — dropdown to filter results by .md, .canvas, or other

## Technical Notes
- Line-type gutter uses CM6 `gutter()` + `GutterMarker` subclasses with cached marker instances
- Footnote hover searches full document text with regex for `[^id]: definition` pattern
- Table sort uses DOM-based row reordering (not React-managed, since innerHTML is set directly)
- Word frequency uses STOP_WORDS set filtering + character stripping for clean word counting
- Sparkline SVG uses `polyline` with `parseFloat` points, colored by trend direction (green up, red down)
- File type filter applies client-side after fetch, no server changes needed
