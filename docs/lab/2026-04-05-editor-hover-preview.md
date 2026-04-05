# Editor Hover Preview for Wikilinks

**Date**: 2026-04-05
**Status**: Complete

## What was built

### Floating note preview in editor mode
- Hovering over `[[wikilinks]]` in the CM6 editor shows a rendered preview of the linked note
- 300ms hover delay before showing (matches reader view behavior)
- Viewport-aware positioning: flips above the link if preview would overflow the bottom
- Preview limited to first ~800 chars with "..." truncation
- Frontmatter stripped from preview content
- Preview dismissed on mouseleave

## Key technical decisions
- **Direct DOM listeners** instead of CM6 `domEventHandlers`: The `mousemove` event didn't fire reliably through CM6's internal event routing (especially with synthetic events for testing). Attaching listeners directly to `contentDOM` works reliably.
- **`posAtCoords` for position mapping**: CM6's `view.posAtCoords({x, y})` maps mouse coordinates to document position, then `doc.lineAt(pos)` + regex finds the wikilink under the cursor
- **Mouse coordinate capture at dispatch time**: `mouseX`/`mouseY` stored in closure before the async `setTimeout` + `fetch` chain, since the original event is gone by callback time
- **Shared markdown renderer**: `createMarkdownRenderer()` instance reused for all previews (created once per editor lifecycle)

## Files changed
- `packages/web/src/components/Editor.tsx` — DOM hover listeners on contentDOM, removeHover cleanup, markdown import
