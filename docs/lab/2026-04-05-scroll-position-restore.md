# Scroll Position Restore

**Date**: 2026-04-05
**Status**: Complete

## What was built
- Scroll position is saved per tab and restored when switching back
- 300ms debounce on scroll saves to avoid state update storms
- Uses `requestAnimationFrame` for smooth restoration timing

## Implementation
- Added `scrollTop: number` field to the `Tab` interface
- Created `ScrollContainer` component wrapping the content area
- Tracks `lastTabId` ref to detect tab switches and trigger restore
- Debounced scroll handler (300ms) calls `updateTab` to persist scroll position
- `requestAnimationFrame` ensures DOM is ready before setting scrollTop

## Files changed
- `packages/web/src/App.tsx` — Tab interface, ScrollContainer component, replaced content div
