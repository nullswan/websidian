# Lab Note: UX Polish Batch 11

**Date**: 2026-04-06
**Focus**: Inline title, soft delete, search filters, split pane drag, footnote popover

## Features Added

### Editor
1. **Auto-focus inline title on new note** — creating a new note focuses and selects the inline title text for immediate renaming
2. **Ctrl+Shift+V paste as plain text** — strips HTML formatting, pastes raw text using navigator.clipboard API

### File System
3. **Trash / soft delete** — files moved to `.trash/` instead of permanent delete. Trash panel in left sidebar with restore and permanent delete per file, "Empty Trash" button. Server: GET /trash, POST /trash/restore, DELETE /trash/empty
4. **File tree reveal flash** — purple highlight pulse animation when auto-revealing active file

### Reader
5. **Footnote popover on click** — clicking footnote ref shows inline popover with content instead of scrolling to bottom, click outside to dismiss

### Tab Bar
6. **Drag tab to split** — dragging tab to right 80px of content area shows "Split" indicator, creates new split pane on drop
7. **"Open in New Pane" context menu** — right-click tab option to open note in a new split pane

### Search
8. **Path filter prefix** — `path:folder/ query` restricts search results to files within specific folder

### Sidebar
9. **Backlinks sort toggle** — A-Z / Z-A alphabetical sort toggle in backlinks panel

## Technical Notes
- Soft delete uses `rename()` to move files to `.trash/` preserving relative paths — atomic on most filesystems
- Footnote popover clones `<li>` content from footnotes-list, strips backref links, positions absolutely relative to reader container
- Drag-to-split detects mouse position via `onDragOver` `clientX` relative to pane bounding rect, rightmost 80px triggers split zone
- `setTimeout(() => addEventListener(...), 0)` defers click-outside handler to prevent immediate close from same event
- `document.createRange().selectNodeContents()` used for programmatic text selection in contentEditable inline title
- Search path filter parsed client-side from query string prefix, applied as `startsWith` filter on results
