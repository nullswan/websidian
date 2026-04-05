# File Tree Filter

**Date**: 2026-04-05
**Status**: Complete

## What was built
- Search input at top of file tree that filters entries as you type
- Case-insensitive substring matching on file/folder names
- Folders shown if any of their children match (recursive)
- Clearing the input restores the full tree

## Implementation
- Added `filterTree(entries, query)` recursive function
- Files: included if name contains query
- Directories: included if name matches OR any children match
- `useMemo` for filtered results, keyed on entries + filter
- Styled input matching dark theme (dark bg, border, placeholder)

## Files changed
- `packages/web/src/components/FileTree.tsx` — added filter state, filterTree function, filter input JSX
