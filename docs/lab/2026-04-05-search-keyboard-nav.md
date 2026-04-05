# Search Result Keyboard Navigation

**Date**: 2026-04-05
**Status**: Complete

## What was built

### Arrow key navigation in search results
- ArrowDown/ArrowUp from the search input moves selection through result files
- Enter navigates to the selected file (with search query for match highlighting)
- Selected result highlighted with purple tint background
- Auto-scrolls to keep selected result visible
- Selection resets when results change

## Key technical decisions
- **`selectedIdx` state**: Simple integer index into the results array, -1 means no selection
- **Input `onKeyDown`**: ArrowDown/ArrowUp/Enter handled directly on the search input, so keyboard navigation works without leaving the input field
- **`scrollIntoView({ block: "nearest" })`**: Prevents jarring scroll jumps when navigating long result lists

## Files changed
- `packages/web/src/components/SearchPanel.tsx` — `selectedIdx` state, onKeyDown handler, highlight styling, auto-scroll ref
