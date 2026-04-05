# Pinned Tabs

**Date**: 2026-04-05
**Status**: Complete

## What was built
- Tabs can be pinned/unpinned via the right-click context menu
- Pinned tabs: compact (2-char abbreviation), no close button, sorted to the left
- Middle-click does not close pinned tabs
- "Close Others" skips pinned tabs
- Pin state persists via workspace localStorage save
- Visual: tighter padding, bolder text, distinct border

## Implementation
- Added `pinned?: boolean` to Tab interface
- Tab bar sorts `tabIds` with pinned tabs first (stable sort)
- Pinned tab renders 2-char abbreviation with tooltip for full name
- Non-pinned tabs render normally with close button
- Context menu shows "Pin Tab" / "Unpin Tab" toggle
- `onAuxClick` guard: `!tab.pinned` before closing
- `.tab.pinned` CSS class: tighter padding, bold text

## Files changed
- `packages/web/src/App.tsx` — Tab interface, drag ref, tab rendering, context menu
- `packages/web/src/styles.css` — .tab.pinned styles
