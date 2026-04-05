# External Links & Favicon

**Date**: 2026-04-04
**Status**: Complete

## What was built
- External links (`https://...`) open in new tabs with `target="_blank"` and `rel="noopener noreferrer"`
- Small arrow icon (↗) appended via CSS `::after` pseudo-element on external links
- SVG favicon added — purple circle with obsidian-like gem shape

## Implementation
- Added `link_open` renderer override in `markdown.ts` to detect `https?://` hrefs and set target/rel attributes
- CSS rule `.reader-view a[target="_blank"]::after` appends the arrow indicator
- Inline SVG data URI favicon in `index.html` `<link rel="icon">`

## Files changed
- `packages/web/src/lib/markdown.ts` — link_open renderer override
- `packages/web/src/styles.css` — external link arrow icon
- `packages/web/index.html` — SVG favicon
