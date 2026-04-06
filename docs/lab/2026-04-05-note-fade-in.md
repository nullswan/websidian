# Note Content Fade-In

**Date**: 2026-04-05
**Status**: Complete

## What was built

### Smooth fade-in animation on tab switch
- Content area fades in with 150ms ease-out animation when switching tabs
- Pure CSS @keyframes animation triggered by React key change
- Scroll container remains stable (not re-keyed), only inner content div transitions

## Key technical decisions
- **React key prop**: `<div key={tabId}>` triggers unmount/remount on tab switch, naturally replaying CSS animation
- **Separation of concerns**: Scroll container persists across switches for position restore; animated div is nested inside

## Files changed
- `packages/web/src/styles.css` — @keyframes note-fade-in, .note-content-fade class
- `packages/web/src/App.tsx` — keyed wrapper div in ScrollContainer
