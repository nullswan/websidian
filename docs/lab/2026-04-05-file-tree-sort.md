# File Tree Sort Options

**Date**: 2026-04-05
**Status**: Complete

## What was built

### Sort toggle button
- Small icon button next to the filter input in file explorer
- Toggles between "name" (alphabetical) and "mtime" (most recently modified first)
- Visual icon changes: short→long lines for name, long→short for mtime
- Icon turns purple (#7f6df2) when mtime mode is active
- Tooltip shows current mode and what clicking will do
- Sort preference persisted in localStorage (`filetree-sort` key)

### Sort behavior
- Folders always sort before files regardless of mode
- Within files, "name" sorts alphabetically (localeCompare)
- Within files, "mtime" sorts newest first (descending mtime)
- Directories use alphabetical sort in both modes (no meaningful mtime)
- Sort applies recursively through all nested folders

## Key technical decisions
- **SortMode type**: `"name" | "mtime"` union, kept simple (no enum overhead)
- **Type narrowing**: Uses `kind === "file"` for mtime access to satisfy TypeScript (VaultFileEntry has mtime, VaultFolderEntry does not)
- **Prop threading**: `sortMode` passed through FileTreeNode props for recursive consistency

## Files changed
- `packages/web/src/components/FileTree.tsx` — sortEntries accepts mode, sort state + toggle button, sortMode prop on FileTreeNode
