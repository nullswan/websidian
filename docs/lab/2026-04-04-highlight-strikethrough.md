# Highlight & Strikethrough Syntax

**Date**: 2026-04-04
**Status**: Complete

## What was built

### ==highlight== syntax
- `==text==` renders as `<mark>` with amber background (`rgba(255, 208, 0, 0.25)`)
- Custom inline rule in markdown-it scans for `==` delimiters
- Matches Obsidian's native highlight appearance

### ~~strikethrough~~ syntax
- `~~text~~` renders as `<s>` — already built into markdown-it by default
- Styled with muted color (#888) to match dark theme

## Implementation
- Added `highlightRule` inline rule to markdown.ts
- Renderer outputs `<mark>` element with escaped content
- CSS styles for `.reader-view mark` and `.reader-view s` in styles.css

## Files changed
- `packages/web/src/lib/markdown.ts` — highlight inline rule + renderer
- `packages/web/src/styles.css` — mark and strikethrough styles
- `fixtures/test-vault/Concepts.md` — added Text Formatting section
