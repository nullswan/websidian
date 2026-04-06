# Lab Note: UX Polish Batch 4 (2026-04-06)

## Features Added (14 items)

### Navigation
- **Ctrl+1-9 tab switching** — browser-style shortcut to jump to Nth tab, Ctrl+9 always goes to last tab
- **PDF file viewer** — .pdf files render via browser's built-in PDF viewer in iframe
- **Image file viewer** — image files (png, jpg, gif, svg, webp) show centered preview
- **Audio file player** — .mp3/.wav/.ogg/.flac files show native audio player widget
- **Video file player** — .mp4/.webm/.mov files show native video player

### Search
- **Expandable search context** — "Show N more matches..." expands inline instead of navigating away, "Show less" to collapse

### Editor
- **Trailing whitespace indicator** — subtle purple dot pattern on trailing spaces via CM6 highlightTrailingWhitespace
- **Image path autocomplete** — typing `![[` triggers dropdown with vault image files filtered by extension
- **Frontmatter key autocomplete** — typing in YAML frontmatter suggests common keys (tags, aliases, cssclass, date, etc.)

### Reader
- **Tag hover popover** — hovering #tag shows count + list of notes sharing the tag
- **Animated link hover underline** — smooth expanding underline on wikilinks and external links via background-size transition
- **Note date display** — "Created / Modified" dates shown below inline title in reader mode

### File Tree
- **Color-coded file icons** — PDF red, JSON yellow, CSS blue, JS/TS gold, audio pink, video brown
- **Sort by file size** — fourth sort mode cycling through name → modified → created → size
- **File properties in context menu** — right-click shows file size, modified date, created date

## Technical Notes
- Ctrl+1-9 intercepts digit keys before hotkey map lookup to avoid combo conflicts
- Image autocomplete fetches `/api/vault/files` and filters by extension client-side
- Tag hover uses same `.hover-preview` CSS class as wikilink hover for visual consistency
- Animated underline uses `background-image` gradient trick with `transition: background-size`
- PDF viewer uses iframe pointing to `/api/vault/raw?path=...` which serves correct MIME type
- Frontmatter completion detects context by walking lines to find closing `---` fence
- File sort by size uses `VaultFileEntry.size` field from vault scan
