# Tab Bar Horizontal Scroll

**Date**: 2026-04-05
**Status**: Complete

## What was built
- Tab bar scrolls horizontally when tabs overflow the available width
- Active tab automatically scrolls into view when switched to
- Mouse wheel on tab bar scrolls horizontally (deltaY mapped to scrollLeft)
- Hidden scrollbar for clean appearance (scrollbar-width: none + ::-webkit-scrollbar)

## Implementation
- `scrollIntoView({ block: "nearest", inline: "nearest" })` via ref callback on active tab
- `onWheel` handler on tab-bar div translates vertical scroll to horizontal
- CSS already had `overflow-x: auto` and hidden scrollbar styles
- `data-tab-id` attribute added for potential future use

## Files changed
- `packages/web/src/App.tsx` — added onWheel handler, ref callback with scrollIntoView, data-tab-id attribute
