# Live Preview Editor

**Date**: 2026-04-04
**Status**: Complete

## What was built

### Obsidian-style mode toggle
- Replaced two-button "Read/Edit" text toggle with single icon button
- Book icon (open book SVG) in reading view, pen icon (pencil SVG) in editing view
- Click toggles between modes, tooltip shows shortcut (Ctrl+E)
- Positioned top-right of tab bar matching Obsidian's layout

### Live Preview CodeMirror styling
- Headings rendered at proper sizes (1.8em H1 down to 1em H6) with muted white color
- H1 gets bottom border separator like Obsidian
- Wikilinks colored in purple accent (#7f6df2) with underlines
- Bold, italic, strikethrough, code styling
- Sans-serif font (system font stack) instead of monospace
- Line numbers hidden for clean WYSIWYG feel
- Purple cursor and subtle active line highlight
- Content padding and max-width for focused writing

### Technical details
- Used `oneDarkTheme` (chrome only) instead of `oneDark` (chrome + syntax highlighting)
- Custom `HighlightStyle` with `@lezer/highlight` tags for full control over token colors
- `ViewPlugin` for heading line decorations (padding, border)
- Added content sync effect: when content arrives async (workspace restore), editor updates via `view.dispatch()`

## Files changed
- `packages/web/src/components/Editor.tsx` — complete rewrite with Live Preview styling
- `packages/web/src/App.tsx` — replaced mode-toggle div with single icon button
- `packages/web/src/styles.css` — replaced .mode-toggle styles with .mode-toggle-btn
