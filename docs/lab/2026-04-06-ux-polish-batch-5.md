# Lab Note: UX Polish Batch 5 (2026-04-06)

## Features Added (16 items)

### Editor
- **Pair deletion** — Backspace between `[[]]`, `****`, `~~~~`, `====`, `` `` ``, `**`, `__` deletes both sides
- **Smooth cursor blink** — ease-in-out opacity fade replaces CM6's harsh step blink

### Status Bar
- **Global vault word count** — "Vault: Xw" fetched from /api/vault/stats, cached in module scope
- **Selection word count** — shows "X chars (Y words) selected" when text is highlighted

### File Tree
- **Drag-to-create folder** — dashed drop zone appears during drag, prompts for folder name, moves file in
- **Recently modified badge** — teal dot next to files modified within last hour
- **Filter match highlighting** — matching portion of names shown in accent color bold

### Tabs
- **Word count goal ring** — SVG progress ring on tab for notes with `wordGoal` frontmatter
- **Tab count badge** — purple badge on right scroll button showing total open tab count
- **Active tab accent underline** — accent-colored bottom border on active tab (inset box-shadow)

### Minimap / Scrollbar
- **Search match markers** — orange tick marks on minimap right edge for lines matching search query

### Sidebar
- **Collapsible outline sections** — headings with children show ▾/▸ toggle to collapse sub-headings
- **Active ribbon indicator** — 2px accent left border on the currently active sidebar icon
- **CSS snippet live preview** — hover inactive snippets to temporarily inject their CSS

### Reader
- **Image lightbox** — click image opens fullscreen overlay with blur backdrop, Esc/click to close
- **Search empty state** — tips panel when search has no query (regex, case-sensitive, tag hints)

### Styling
- **Readable line length guide** — subtle gradient border on reader-view edges, hidden in wide mode
- **Graph label truncation** — long node names truncated at 20 chars with ellipsis

## Technical Notes
- Pair deletion keymap placed before default keymap to intercept Backspace first
- Vault stats cached in module-scope variable to avoid re-fetching across re-renders
- Drag-to-create-folder uses two-phase flow: drop zone → InlineInput prompt → create + move
- Outline collapse uses recursive `isVisible()` walking backwards to find collapsed ancestors
- Image lightbox uses fixed overlay with `backdrop-filter: blur(4px)` and Escape key handler
- Minimap search markers drawn as orange rectangles on right edge of canvas
- Filter highlight uses `highlightMatch()` function splitting name at case-insensitive match index
