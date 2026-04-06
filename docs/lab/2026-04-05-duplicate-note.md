# Duplicate Note

**Date**: 2026-04-05
**Status**: Complete

## What was built

### Duplicate note from context menus
- Tab context menu: right-click tab > "Duplicate"
- File tree context menu: right-click file > "Duplicate"
- Creates copy with " copy" suffix (deduplicates up to 20)
- Opens duplicate in new tab, shows toast
- Fetches content from server for file tree (consistent behavior)

## Key technical decisions
- **Centralized `duplicateNote` callback**: Shared by tab and file tree context menus
- **Server-side dedup check**: HEAD requests check for existing copies to generate unique names
- **Content fetch**: Always fetches from server (not tab cache) for consistency

## Files changed
- `packages/web/src/App.tsx` — duplicateNote callback, tab context menu entry, FileTree prop
- `packages/web/src/components/FileTree.tsx` — onDuplicate prop, context menu entry
