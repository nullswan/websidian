# Hover Preview for Wikilinks

**Date**: 2026-04-04
**Status**: Complete

## What was built
- Hovering over a `[[wikilink]]` shows a floating preview of the linked note
- Preview renders markdown content (headings, lists, links, etc.)
- 300ms hover delay to avoid flicker on quick mouse passes
- Dark-themed popup with shadow, positioned near the link
- Auto-flips upward if preview would overflow viewport bottom
- Content truncated to ~800 chars for performance
- Matches Obsidian's "Page Preview" core plugin

## Implementation
- `mouseover` event listener on reader container detects `.wikilink` hovers
- Resolves link via `/api/vault/resolve`, fetches content via `/api/vault/file`
- Strips frontmatter, renders with markdown-it, creates floating `<div class="hover-preview">`
- Positioned absolutely relative to reader container
- `mouseout` cleans up preview (with relatedTarget check to avoid premature removal)
- `pointer-events: none` CSS so preview doesn't block link clicks

## Files changed
- `packages/web/src/components/Reader.tsx` — hover preview useEffect
- `packages/web/src/styles.css` — `.hover-preview` styles, `position: relative` on `.reader-view`
