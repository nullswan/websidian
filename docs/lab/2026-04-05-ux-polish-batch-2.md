# Lab Note: UX Polish Batch 2 (2026-04-05)

## Features Added (12 items)

### Quick Switcher
- **Create note from quick switcher** — "Create note: [query]" option when no results found, Enter creates and opens in edit mode

### Navigation
- **Smooth scroll to heading** — clicking [[Note#Heading]] scrolls to target heading after navigation via ID or text match
- **Outline indent guides** — vertical guide lines for nested heading levels in outline sidebar

### Canvas
- **Canvas improvements** — dot grid background, SVG arrow markers on edges, edge labels, group nodes with dashed borders, link node type

### Editor
- **Code block syntax highlighting** — @codemirror/language-data wired for on-demand language grammars in fenced code blocks
- **Link hover underline** — wikilinks show underline + pointer cursor on hover in Live Preview
- **Callout autocomplete** — typing > [! triggers dropdown with 13 callout types

### Graph
- **Zoom control buttons** — +, -, and reset buttons in bottom-right corner

### Sharing
- **Share note as read-only link** — POST /api/vault/share creates share link, /#/share/:id renders minimal read-only page

### Reading View
- **Task progress bar** — compact done/total bar above content when note has checkboxes, green at 100%

### Settings & Appearance
- **Font family selection** — system, sans-serif, serif, monospace options in Settings, applied via CSS variable
- **File tree sort by creation date** — ctime added to VaultFile, sort cycles through name/mtime/ctime

## Technical Notes
- Heading scroll uses two-phase lookup: getElementById (fast) → text-match fallback
- Language grammars lazy-loaded via @codemirror/language-data — no upfront bundle cost
- Share registry stored in .obsidian/shared.json following Obsidian's config convention
- Canvas dot grid uses CSS radial-gradient that scales with zoom and shifts with pan
- ctime populated from fs.stat.birthtimeMs (file creation time on macOS/APFS)
