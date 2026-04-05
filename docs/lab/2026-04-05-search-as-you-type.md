# Search-as-you-type with Collapsible Results

**Date**: 2026-04-05
**Status**: Complete

## What was built

### Live search with debounce
- Search panel now searches automatically as you type (300ms debounce)
- No longer requires pressing Enter (though Enter still works to force immediate search)
- Clear button (×) to reset search input and results

### Collapsible file groups
- Each file result is a collapsible group with ▾/▸ toggle
- Per-file match count shown on the right
- Click the file name to navigate, click the row to collapse/expand

### Match count summary
- "N matches in M files" shown below the search input
- Shows up to 5 matches per file (was 3), with "+N more" link

## Key technical decisions
- **`useEffect` + `useRef` debounce**: Timer stored in ref, reset on each query change via useEffect cleanup. More React-idiomatic than managing timer in onChange.
- **Collapse state via `Set<string>`**: Toggle via functional setState that creates new Set to trigger re-render
- **Increased match limit**: 5 per file (up from 3) since collapsible groups make long result lists manageable

## Files changed
- `packages/web/src/components/SearchPanel.tsx` — full rewrite with debounce, collapsible groups, match count, clear button
