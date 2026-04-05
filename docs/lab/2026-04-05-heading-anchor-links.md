# Heading Anchor Copy Links

**Date**: 2026-04-05
**Status**: Complete

## What was built

### Heading anchor links in reader view
- Hovering any heading (H1-H6) reveals a `#` icon to the right
- Clicking it copies `[[NoteName#Heading]]` to clipboard
- Visual feedback: icon changes to purple `✓` for 1.5 seconds
- Co-located with existing fold arrow — both appear/disappear on hover

## Key technical decisions
- **Note name from filePath**: Extracted via `filePath.replace(/\.md$/, "").split("/").pop()` for the wikilink target
- **Heading text cleanup**: Strips `▶` fold arrow text from `textContent` before constructing the link
- **Absolute positioning**: `right: -24px` places the anchor outside the heading text flow
- **Added filePath to useEffect deps**: Since heading anchors now depend on the note name

## Files changed
- `packages/web/src/components/Reader.tsx` — anchor element creation, click handler, hover show/hide
