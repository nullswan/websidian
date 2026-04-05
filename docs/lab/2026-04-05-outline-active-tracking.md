# Outline Active Heading Tracking

**Date**: 2026-04-05
**Status**: Complete

## What was built
- The outline sidebar now highlights the currently visible heading as the user scrolls
- Active heading shown in purple (#7f6df2) with bold weight and a left border indicator
- Uses IntersectionObserver for efficient scroll-based tracking
- Clicking an outline entry also immediately updates the active state

## Implementation
- `IntersectionObserver` with `rootMargin: "-10% 0px -80% 0px"` targets the top ~10% of the viewport
- Maps DOM headings to outline indices by matching text content
- 200ms delay before observing to let the reader render
- Strips fold arrow characters (▶) from heading text when matching
- Cleanup on unmount or content change

## Files changed
- `packages/web/src/components/Outline.tsx` — added IntersectionObserver, activeIdx state, purple highlight styling
