# Unresolved Wikilink Styling

**Date**: 2026-04-05
**Status**: Complete

## What was built

### Reader view: dimmed unresolved wikilinks
- After rendering, a hydration `useEffect` queries all `a.wikilink[data-target]` elements
- Each link is resolved via `GET /api/vault/resolve?target=...&from=...`
- Links with no resolution get `.wikilink-unresolved` CSS class
- Unresolved links shown at 50% opacity (70% on hover), matching Obsidian behavior

## CSS classes
- `.wikilink-unresolved` — dimmed opacity, no underline by default
- `.wikilink-unresolved:hover` — subtle underline at 70% opacity

## Files changed
- `packages/web/src/components/Reader.tsx` — new hydration useEffect for link resolution
- `packages/web/src/styles.css` — `.wikilink-unresolved` styles
