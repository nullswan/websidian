# Toast Notification System

**Date**: 2026-04-05
**Status**: Complete

## What was built
- Transient toast notifications at bottom-center of viewport
- Auto-dismisses after 2 seconds
- Currently wired to: "Copy Path" context menu action, note creation (Ctrl+N)
- Dark themed, centered, with subtle shadow

## Implementation
- `toast` state (string | null) and `showToast` callback in App
- `toastTimer` ref for auto-dismiss via setTimeout(2000)
- Fixed position div at bottom: 32px, left: 50%, transform: translateX(-50%)
- z-index: 2000, pointer-events: none (non-blocking)
- `showToast` is stable via useCallback, safe to pass to child components

## Files changed
- `packages/web/src/App.tsx` — added toast state, showToast callback, toast JSX, wired to Copy Path and createNewNote
