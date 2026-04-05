# File Tree Keyboard Navigation

**Date**: 2026-04-05
**Status**: Complete

## What was built

### Arrow key navigation in file explorer
- ArrowDown/ArrowUp: move focus through visible tree items
- ArrowRight: expand collapsed folder
- ArrowLeft: collapse expanded folder, or move to parent folder
- Enter: open focused file or toggle focused folder
- Focused item highlighted with purple tint + border ring
- Auto-scrolls to keep focused item visible

## Key technical decisions
- **`flattenVisible` helper**: Recursively walks sorted tree, only descending into expanded folders, producing a flat path array matching visual order. Memoized with `useMemo` on `[filteredEntries, expandedPaths, sortMode]`.
- **`tabIndex={0}` on `<ul>`**: Makes the tree list focusable for keyboard events without stealing focus from other elements
- **`focusedPath` state separate from `selectedPath`**: Focus (keyboard highlight) is independent from selection (active tab) — mirrors VS Code/Obsidian behavior where keyboard browsing doesn't open files until Enter is pressed
- **`scrollIntoView({ block: "nearest" })`**: Keeps focused item visible without jarring scroll jumps

## Files changed
- `packages/web/src/components/FileTree.tsx` — `flattenVisible`, `focusedPath` state, `handleTreeKeyDown`, focus styling on folder/file nodes, `useCallback` import
