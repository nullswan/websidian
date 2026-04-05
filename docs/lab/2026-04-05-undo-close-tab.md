# Undo Close Tab (Ctrl+Shift+T)

**Date**: 2026-04-05
**Status**: Complete

## What was built

### Reopen recently closed tabs
- Ctrl+Shift+T reopens the most recently closed tab
- Stack-based: pressing multiple times reopens tabs in reverse close order
- Stack capped at 20 entries to prevent memory growth
- Also available as "Undo Close Tab" in the command palette (Ctrl+P)
- Added to keyboard shortcuts overlay (Ctrl+/)

## Key technical decisions
- **`useRef` instead of `useState`**: The closed tabs stack doesn't need to trigger re-renders — it's only read on keypress or command palette action
- **Path-based storage**: Only the file path is stored (not tab state), so reopened tabs start fresh with content fetched from the server
- **Stack in `closeTab` callback**: Path is captured from `tabsMap` before the tab entry is deleted

## Files changed
- `packages/web/src/App.tsx` — `closedTabsStack` ref, closeTab push logic, Ctrl+Shift+T handler, command palette entry, shortcuts overlay entry
