# Clickable Inline Tags

**Date**: 2026-04-04
**Status**: Complete

## What was built
- Clicking an inline `#tag` in reader view opens the search panel with that tag as the query
- Search results show all notes containing the tag
- Tags now have `cursor: pointer` and `data-tag` attribute

## Implementation
- Markdown renderer adds `data-tag` attribute to tag spans
- Reader.tsx handles clicks on `span.tag[data-tag]` and calls `onTagClick`
- App.tsx passes `onTagClick` to Reader, sets `searchQuery` state, switches to search panel
- SearchPanel accepts `initialQuery` prop, auto-searches when it changes

## Files changed
- `packages/web/src/lib/markdown.ts` — added `data-tag` attribute and cursor to tag renderer
- `packages/web/src/components/Reader.tsx` — added `onTagClick` prop, tag click handler
- `packages/web/src/components/SearchPanel.tsx` — added `initialQuery` prop with effect
- `packages/web/src/App.tsx` — added `searchQuery` state, wired tag click to search panel
