# Lab Note: UX Polish Batch 3 (2026-04-05)

## Features Added (9 items)

### Editor
- **Alt+Click peek preview** — hovering wikilinks in editor with Alt+Click shows floating rendered note preview, dismissible with Escape
- **Multiple cursor count** — status bar shows "N cursors" in accent color when multiple cursors active (Ctrl+D / Ctrl+Shift+L)

### Settings & Customization
- **Hotkey customization panel** — Settings > Hotkeys section with searchable list, click-to-record key recorder, per-hotkey reset button, localStorage persistence
- **Stacked tabs mode** — Andy Matuschak sliding panes, togglable in Settings or command palette, horizontal scroll with snap

### Daily Notes
- **Calendar popover** — mini month grid on ribbon calendar icon, highlights days with existing daily notes, click to open/create

### Status Bar
- **Word count goal** — frontmatter `wordGoal: N` shows circular SVG progress ring, turns green at 100%

### Reader
- **Auto-link dates** — YYYY-MM-DD patterns auto-detected and rendered as clickable links to daily notes with dashed underline

### Sidebar
- **File info panel** — right sidebar section showing words, chars, links, backlinks, file size, created/modified dates
- **Backlink count badges** — file tree shows purple count badge for files with incoming backlinks

## Technical Notes
- Hotkey system uses two-layer architecture: `HOTKEY_ACTIONS` defaults + `HotkeyOverrides` in localStorage, merged via `buildHotkeyMap()` for O(1) keydown matching
- Key recorder uses capture-phase event listener to intercept before other handlers
- Calendar uses `new Date(year, month+1, 0).getDate()` trick for days-in-month calculation
- Stacked tabs uses CSS scroll-snap for natural card-flipping behavior
- Date auto-linking implemented as markdown-it core ruler that rewrites text tokens
- Backlink counts computed from graph API edges data fetched once on load
