# Daily Notes

**Date**: 2026-04-04
**Status**: Complete

## What was built

- Ctrl+D / Cmd+D keyboard shortcut to open today's daily note
- "Open Daily Note" command in command palette
- Creates `Daily Notes/YYYY-MM-DD.md` with date heading if it doesn't exist
- Opens existing daily note if already present
- Refreshes tree after creation

## Implementation
- `openDailyNote` callback in App.tsx
- Checks if file exists via GET, creates via PUT if 404
- Date format matches Obsidian's default daily note format

## Verification
- Playwright screenshot shows daily note opened with full content, properties, backlinks, outline
- Keyboard shortcut (window.dispatchEvent) triggers correctly

## Files changed
- `packages/web/src/App.tsx` — added `openDailyNote` function, Ctrl+D handler, command palette entry
