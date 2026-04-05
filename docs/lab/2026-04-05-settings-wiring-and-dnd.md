# Settings Wiring & Drag-and-Drop File Move

**Date**: 2026-04-05
**Status**: Complete

## What was built

### Show line numbers setting (functional)
- Conditionally include `lineNumbers()` extension in CM6 based on Settings toggle
- Gutter styled for dark theme (`#1e1e1e` bg, `#2a2a2a` border, `#555` numbers) instead of hidden
- Editor recreates when `showLineNumbers` changes via useEffect dependency

### Tab size setting (wired)
- `EditorState.tabSize.of(tabSize)` controls how `\t` characters render
- `indentUnit.of(" ".repeat(tabSize))` controls what Tab key inserts
- Both are needed for consistent behavior

### Drag-and-drop file move in file tree
- Files and folders are draggable (`draggable` attribute + `onDragStart`)
- Folders are drop targets (`onDragOver` + `onDrop`)
- Root `<ul>` is also a drop target for moving to vault root
- Drop triggers `/api/vault/rename` which handles directory creation and wikilink updates
- Purple highlight on drag-over targets (`rgba(127,109,242,0.15)` + outline)
- Self-drop and ancestor-drop prevented (can't drop folder into itself)

## Key technical decisions
- Reused existing rename API for moves — it already calls `mkdir(recursive: true)` and updates wikilinks
- `dataTransfer.setData("text/plain", path)` passes source path through drag without shared state
- `e.stopPropagation()` on nested folders prevents parent folders from stealing drop events
- `onFileRenamed` callback reused for both rename and move (same effect on tabs)

## Files changed
- `packages/web/src/components/Editor.tsx` — tabSize prop, indentUnit, lineNumbers conditional
- `packages/web/src/App.tsx` — pass tabSize and showLineNumbers to Editor
- `packages/web/src/components/FileTree.tsx` — drag-and-drop handlers, drop target highlight
