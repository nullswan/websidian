# Lab Note: Editor UX Polish & Feature Batch

**Date:** 2026-04-05

## Features Implemented

### Editor Enhancements
- **Snippet expansion** (Tab trigger): `td`→date, `now`→datetime, `cb`→code block, `tbl`→table, `meta`→frontmatter, etc.
- **Sort selected lines**: Shift+Alt+S (A-Z) / Shift+Alt+R (Z-A) with locale-aware comparison
- **HTML comment toggle**: Cmd+/ wraps/unwraps `<!-- -->` on selection or line
- **Bare URL highlighting**: purple underline on bare http(s) URLs, Ctrl+Click opens in new tab
- **URL hover tooltip**: fetches page title via `/api/vault/fetch-title`, shows in floating tooltip
- **Unlinked mention suggestions**: dotted underline on text matching note names, Alt+Click to convert to [[wikilink]]
- **Heading link copy gutter**: hover heading line shows #, click copies [[Note#Heading]]
- **Paragraph word count gutter**: subtle word count at start of each paragraph (5+ words)
- **Trim trailing whitespace**: Settings toggle, auto-trims on save

### UI/UX Improvements
- **Pane sync scroll**: ⇅ button on split divider, fraction-based proportional scroll sync
- **Local graph 2-hop depth**: depth toggle (1/2/3) with full graph BFS expansion
- **Chapter dots**: vertical dots on right edge of reader, one per heading, click to scroll
- **Rich tab tooltip**: hover shows "path · X words · Y backlinks"
- **Clickable word wrap toggle**: click "Wrap"/"No Wrap" in status bar
- **Frontmatter templates**: 5 built-in presets via command palette
- **Set word count goal**: command palette action writes wordGoal to frontmatter

## Architecture Notes

### Sync Scroll Lock Pattern
Uses `syncScrollLock` ref to prevent infinite feedback loops:
1. Pane A scrolls → emits fraction → sets Pane B's scrollTop
2. Lock engaged → Pane B's scroll event fires → callback checks lock → no-op
3. `requestAnimationFrame` clears lock

### Snippet Priority
`snippetKeymap` placed before `indentWithTab` in CM6 extension array.
Tab key checks snippets first; if no match, falls through to indent.

### Unlinked Mentions Lazy Load
ViewPlugin fetches note names once on construction, then uses
`view.dispatch({ effects: [] })` to trigger decoration rebuild after async data arrives.
