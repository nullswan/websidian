# Lab Note: Graph Path Finder + UI Polish Batch

## Features Added

### Graph Path Finder
- BFS shortest path between two nodes via Alt+Click
- Gold-highlighted path edges (3px) and nodes (enlarged + glow)
- Breadcrumb trail showing ordered hops with click-to-navigate
- Non-path elements dim when path is active
- Clear button to reset selection

### Tag Hover Popover — Clickable Notes
- Notes listed in tag hover popup are now clickable links
- Click navigates to the note, hover highlights with accent color

### Keyword Cloud (Right Sidebar)
- Top 20 most frequent non-stop-words from current note
- Sized by frequency, click to search vault
- Displayed between Outline and Tags sections

### Inline Dataview Queries
- `dataview` code blocks render as live query results
- Supports LIST and TABLE query types
- FROM #tag, FROM "folder", SORT, LIMIT directives
- Results render as clickable wikilinks

### Floating Format Toolbar
- Appears above selected text in editor
- Bold, Italic, Strikethrough, Code, Highlight, Link buttons
- mousedown prevents focus loss during formatting

### Outline Reading Time
- Shows estimated reading time (Xm) per heading section
- Based on 200 wpm, only for sections with 20+ words

### Reader Properties Panel
- Computed metadata: word count, links, tags, headings
- Styled as italic/muted rows below YAML properties

### Vault Statistics Charts
- Word count distribution bar chart (8 buckets)
- Folder breakdown with progress bars and word counts

## Architecture Notes
- Graph path finder uses state-to-ref bridging for canvas render loop
- Dataview queries follow the hydration pattern: markdown produces static HTML, useEffect replaces with dynamic content
- Floating toolbar uses mousedown + preventDefault to preserve selection
