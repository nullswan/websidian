# File Tree Sorting

**Date**: 2026-04-05
**Status**: Complete

## What was built
- File tree sorts entries: folders first, then files
- Within each group, sorted alphabetically (case-insensitive)
- Applied at both root level and within folder children

## Implementation
- Added `sortEntries(entries)` helper function
- Sorts by type (directory=0, file=1), then by name via `localeCompare`
- Applied to root `entries.map()` and `entry.children.map()` calls

## Files changed
- `packages/web/src/components/FileTree.tsx` — added sortEntries helper, applied to both rendering points
