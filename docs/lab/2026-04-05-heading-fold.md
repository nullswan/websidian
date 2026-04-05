# Heading Fold/Collapse

**Date**: 2026-04-05
**Status**: Complete

## What was built
- Clickable fold arrows on every heading (h1–h6) in reader view
- Arrows appear on heading hover, always visible when section is folded
- Click toggles visibility of all content under the heading until the next heading of equal or higher level
- Purple color for folded arrows, gray for expanded
- Smooth CSS rotation transition between expanded (▼) and collapsed (▶) states

## Implementation
- Post-render DOM hydration in Reader.tsx (same useEffect that sets innerHTML)
- Each heading gets a prepended `.heading-fold-arrow` span with absolute positioning
- Click handler walks `nextElementSibling` chain, toggling `display: none`
- No React state needed — pure DOM manipulation since content is set via innerHTML

## Files changed
- `packages/web/src/components/Reader.tsx` — heading fold arrow injection and click handler
