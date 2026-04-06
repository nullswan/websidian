# Lab Note: UX Polish Batch (2026-04-05)

## Features Added (16 items)

### Navigation & Search
- **Fuzzy search** in quick switcher with character-by-character match highlighting (purple accent)
- **Search result sorting** — relevance, modified date, or name via dropdown
- **Create note from search** — "Create note: [query]" button when no results found
- **Outline scroll fix** — heading IDs now match between markdown renderer and outline sidebar

### Editor
- **Line wrap toggle** in Settings (CM6 Compartment, hot-swappable)
- **Backspace removes empty list prefix** — pressing Backspace on `- ` or `1. ` strips the marker

### Visual Improvements
- **Graph node tooltips** — hover shows name, word count, link count
- **Graph folder coloring** — nodes colored by parent folder using HSL hue distribution
- **Resizable sidebars** — drag handles on both sides, 140-500px range, persisted
- **Hover preview animation** — 150ms fade-in + right-edge clamping
- **Collapsible note embeds** — tall transclusions capped at 300px with "Show more"
- **Unresolved wikilink styling** — dead links dimmed (50% opacity) via resolve API check

### UI Chrome
- **Tab bar "+" button** — create new note from tab bar
- **Reveal active file** — crosshair button in file tree header with flash highlight
- **Platform-aware shortcuts** — ⌘ on Mac, Ctrl elsewhere (overlay, palette, tooltips)
- **File tree context menu** — "Open in new tab" and "Open to the right"

### Data & Settings
- **Outgoing links** — resolved vs unresolved sections with distinct styling
- **Vault statistics** — note count, word count, attachment count, vault size in Settings
- **Dirty tab confirmation** — browser confirm dialog when closing unsaved tabs

## Technical Notes
- Fuzzy scoring: exact > prefix > substring > consecutive > word-boundary > spread chars
- Sidebar resize uses document-level mousemove/mouseup listeners for smooth dragging
- `kbd()` utility converts "Ctrl+X" to "⌘X" on macOS using navigator.platform detection
- Graph folder colors computed once before tick loop, not per-frame per-node
