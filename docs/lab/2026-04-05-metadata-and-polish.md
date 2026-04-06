# Lab Note: File Metadata, Polish & Missing Features (2026-04-05)

## Features Added

### File Metadata
- Server returns `created`, `modified`, `size` from `stat()` on GET /api/vault/file
- Status bar shows "Created 5 Apr 2026" / "Modified 5 Apr 2026" with ISO tooltip
- Properties sidebar panel shows created/modified dates and file size
- Properties section displays even without frontmatter when file metadata is available

### Reader Improvements
- Block reference transclusion: `![[note#^blockid]]` extracts specific block
- Heading IDs for deep linking (slug-based with duplicate disambiguation)
- `%%comment%%` syntax stripped from rendered output
- Image embed size: `![[image.png|300]]` and `![[image.png|300x200]]`
- Collapsible callout animation (chevron rotation + fade-slide)
- Paragraph spacing increased to `1em` matching Obsidian
- Hover preview shows "Loading..." immediately with error fallback

### Editor Improvements
- Right-click context menu: Cut/Copy/Paste/Select All + Bold/Italic/Strikethrough/Code/Highlight
- Ctrl+Shift+L selects all occurrences of selection
- Context menu markdown toggles support wrap/unwrap

### Navigation & Tabs
- Alt+Left/Right global navigation history (50-entry stack)
- Close Tabs to the Right / Close Tabs to the Left in tab context menu
- Command palette scrollIntoView on keyboard navigation

### Search
- Results sorted by relevance (most matches first)
- Match context trimmed to ~80 chars centered on match

### Graph View
- Filter input to narrow visible nodes
- Orphans toggle checkbox
- Node count display

### Tags
- Cumulative counts in tag tree (parent includes descendants)

## Commits
18 commits in this session covering metadata, transclusion, navigation, and polish.
