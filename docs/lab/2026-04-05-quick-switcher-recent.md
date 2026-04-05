# Quick Switcher Recent Files

**Date**: 2026-04-05
**Status**: Complete

## What was built
- Quick switcher (Ctrl+O) now shows recently opened files when the query is empty
- "RECENT" header label appears above the list
- Deduplicated by path using `Set`
- Once the user starts typing, normal vault search takes over

## Implementation
- Added `recentPaths` prop to `QuickSwitcher` component
- When query is empty, maps `recentPaths` to `Candidate[]` and shows them
- When query is non-empty, fetches from `/api/vault/switcher` as before
- App passes `[...new Set(Object.values(tabsMap).map(t => t.path))]`

## Files changed
- `packages/web/src/components/QuickSwitcher.tsx` — added recentPaths prop, empty-query handling, "Recent" header
- `packages/web/src/App.tsx` — passes recentPaths to QuickSwitcher
