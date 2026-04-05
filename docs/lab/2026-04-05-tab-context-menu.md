# Tab Context Menu

**Date**: 2026-04-05
**Status**: Complete

## What was built
- Right-clicking a tab shows a context menu with 5 options:
  - Close — closes the right-clicked tab
  - Close Others — closes all tabs except the right-clicked one
  - Close All — closes all tabs in the pane
  - Copy Path — copies the file path to clipboard
  - Reveal in File Tree — switches left panel to files view
- Menu dismisses on click outside or after selecting an action
- Separator line between close actions and utility actions

## Implementation
- Added `tabCtxMenu` state tracking `{ x, y, tabId, paneIdx }`
- `onContextMenu` handler on each tab div captures position and tab info
- Full-screen transparent overlay catches click-away
- Menu positioned absolutely at click coordinates
- Hover highlight on menu items via inline event handlers

## Files changed
- `packages/web/src/App.tsx` — added tabCtxMenu state, onContextMenu on tabs, context menu JSX
