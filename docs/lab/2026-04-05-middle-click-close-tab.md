# Middle-Click to Close Tab

**Date**: 2026-04-05
**Status**: Complete

## What was built
- Middle-clicking (mouse button 1) on a tab closes it
- Standard browser/editor convention for tab management
- Prevents default browser middle-click behavior (auto-scroll)

## Implementation
- Added `onAuxClick` handler on each tab div
- Checks `e.button === 1` (middle button) before closing
- Calls existing `closeTab(tab.id, paneIdx)` function
- Uses `e.preventDefault()` to suppress browser default

## Files changed
- `packages/web/src/App.tsx` — added onAuxClick handler on tab elements
