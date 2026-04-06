# Lab Note: UX Polish Batch 3 (2026-04-05)

## Features Added (27 items)

### Editor
- **Alt+Click peek preview** — hovering wikilinks in editor with Alt+Click shows floating rendered note preview, dismissible with Escape
- **Multiple cursor count** — status bar shows "N cursors" in accent color when multiple cursors active (Ctrl+D / Ctrl+Shift+L)
- **Gutter hover line highlight** — hovering gutter area highlights corresponding line with purple tint
- **Block-level drag handle** — ⠿ grip icon appears on line hover, drag to reorder lines
- **Table formatting toolbar** — floating toolbar above tables with add/remove column/row, alignment buttons
- **URL tooltip on hover** — hovering [text](url) in editor shows URL in compact tooltip
- **Fold all / unfold all** — command palette actions using CM6 foldAll/unfoldAll

### Settings & Customization
- **Hotkey customization panel** — Settings > Hotkeys section with searchable list, click-to-record key recorder, per-hotkey reset button, localStorage persistence
- **Stacked tabs mode** — Andy Matuschak sliding panes, togglable in Settings or command palette, horizontal scroll with snap

### Daily Notes
- **Calendar popover** — mini month grid on ribbon calendar icon, highlights days with existing daily notes, click to open/create

### Status Bar
- **Word count goal** — frontmatter `wordGoal: N` shows circular SVG progress ring, turns green at 100%
- **Reading position indicator** — shows "X% read" in reader mode, turns green at 95%

### Reader
- **Auto-link dates** — YYYY-MM-DD patterns auto-detected and rendered as clickable links to daily notes with dashed underline
- **Code playground** — JS/TS/HTML code blocks get a Run button, output displayed below
- **Floating table of contents** — compact mini-TOC on right edge for notes with 3+ headings, tracks scroll
- **Transclusion reference count** — embedded note blocks show "N refs" badge from graph data

### Sidebar
- **File info panel** — right sidebar section showing words, chars, links, backlinks, file size, created/modified dates
- **Backlink count badges** — file tree shows purple count badge for files with incoming backlinks
- **Section count badges** — Backlinks, Outgoing Links, Unlinked Mentions sections show accent-colored pill counts
- **Outline word counts** — each heading shows section word count (e.g., "42w")

### Note Management
- **Merge notes** — command palette action to merge another note into current, appends content, deletes source
- **Version history** — localStorage snapshots (last 10 per note), diff view with line coloring, restore button
- **Split note at heading** — command palette action to split note at second heading, leaves [[wikilink]]
- **Rename heading + update links** — renames heading and updates [[Note#Heading]] refs across vault

### Navigation & Visualization
- **Minimap scroll indicator** — canvas-based document overview on right edge for notes >1000 chars, click to jump
- **Vault statistics dashboard** — summary cards, tag cloud, most linked notes, largest notes, orphan notes
- **Outline smooth scroll + flash** — heading flash animation on navigation, scroll-margin-top offset
- **Outline drag-to-reorder** — drag headings to reorder document sections
- **Tab bar scroll buttons** — left/right arrow buttons when tab bar overflows
- **Command palette recent commands** — shows last 8 used commands at top with "Recent" header

### Appearance
- **Heading numbering** — CSS counter-based auto-numbering (1. 1.1. 2.) toggle in Settings

## Technical Notes
- Hotkey system uses two-layer architecture: `HOTKEY_ACTIONS` defaults + `HotkeyOverrides` in localStorage, merged via `buildHotkeyMap()` for O(1) keydown matching
- Key recorder uses capture-phase event listener to intercept before other handlers
- Calendar uses `new Date(year, month+1, 0).getDate()` trick for days-in-month calculation
- Stacked tabs uses CSS scroll-snap for natural card-flipping behavior
- Date auto-linking implemented as markdown-it core ruler that rewrites text tokens
- Backlink counts computed from graph API edges data fetched once on load
- Minimap uses Canvas 2D with devicePixelRatio scaling for HiDPI sharpness
- Version history stored in localStorage keyed by `note-history:` + path, max 10 snapshots
- Heading numbering uses pure CSS counters — no JavaScript needed, toggled via root class
- Table toolbar is a CM6 ViewPlugin managing its own DOM — uses posAtCoords for positioning
- Block drag handle uses native HTML5 drag-and-drop with CM6 posAtCoords for line detection
- Code playground: JS uses `new Function("console", source)` sandbox, HTML uses `iframe.srcdoc` with sandbox="allow-scripts"
- Floating TOC uses IntersectionObserver for scroll tracking, glassmorphism backdrop-filter
- Outline section word counts computed from source lines between consecutive heading positions
- Tab bar overflow detection uses ResizeObserver to toggle .has-overflow class
- Rename heading endpoint scans all .md files and updates [[Note#OldHeading]] regex patterns
