# Unsaved Changes Warning

**Date**: 2026-04-05
**Status**: Complete

## What was built

### Browser close/refresh warning for dirty tabs
- Shows native browser "Leave site?" dialog when closing/refreshing with unsaved changes
- Checks all tabs for `dirty` flag (set by editor changes, cleared on save)
- Uses modern `e.preventDefault()` API (no deprecated returnValue)
- Works alongside existing auto-save (1.5s debounce) as a safety net

## Files changed
- `packages/web/src/App.tsx` — beforeunload event listener with dirty tab detection
