# Note Creation from Dead Wikilinks

**Date**: 2026-04-04
**Status**: Complete

## What was built
- Clicking a wikilink to a non-existent note creates the note automatically
- New note gets a `# Title` heading matching the link text
- File tree refreshes to show the new file
- New note opens in the active tab immediately
- Backlinks already work for the newly created note

## Implementation
- Modified `handleNavigate` in App.tsx
- When `/api/vault/resolve` returns `resolved: null`, triggers note creation
- Creates note via `PUT /api/vault/file` with path and initial content
- On success, refreshes file tree and opens the new note
- Falls back to error display if creation fails

## Files changed
- `packages/web/src/App.tsx` — handleNavigate: dead link → create → open flow
