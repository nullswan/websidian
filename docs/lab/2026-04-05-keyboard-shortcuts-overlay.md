# Keyboard Shortcuts Overlay

**Date**: 2026-04-05
**Status**: Complete

## What was built
- Modal overlay showing all 11 keyboard shortcuts with descriptions and styled `<kbd>` key combos
- Triggered by Ctrl+/ (toggles on/off)
- Dismissible via Escape, Ctrl+/, or clicking the backdrop
- Clean dark theme with bordered key badges

## Shortcuts listed
- Ctrl+N, Ctrl+D, Ctrl+O, Ctrl+P, Ctrl+E, Ctrl+W
- Ctrl+Tab, Ctrl+Shift+Tab, Ctrl+Shift+F, Ctrl+G, Ctrl+/

## Files changed
- `packages/web/src/App.tsx` — added `showShortcuts` state, Ctrl+/ and Escape handlers, overlay JSX
