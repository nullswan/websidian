# Scroll Progress Indicator

**Date**: 2026-04-05
**Status**: Complete

## What was built
- Thin 2px purple progress bar at the top of the content area
- Fills left-to-right as the user scrolls through a note
- Shows reading progress from 0% (top) to 100% (bottom)
- Smooth CSS transition for visual updates

## Implementation
- Added `progress` state to `ScrollContainer` component
- Progress calculated as `scrollTop / (scrollHeight - clientHeight)` on every scroll event
- Progress bar rendered as two nested divs: background track (#2a2a2a) and fill (#7f6df2)
- `transition: width 0.1s ease-out` for smooth animation
- Also updates on tab restore via `requestAnimationFrame`

## Files changed
- `packages/web/src/App.tsx` — modified ScrollContainer to track and render progress bar
