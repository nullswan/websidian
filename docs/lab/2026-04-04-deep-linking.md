# URL Hash Routing / Deep Linking

**Date**: 2026-04-04
**Status**: Complete

## What was built
- URL hash updates to reflect the active note: `#/note/Welcome.md`
- Direct navigation via URL: `http://host/#/note/Projects%2FProject%20Alpha.md`
- Nested paths with URL encoding work correctly
- Uses `replaceState` to avoid cluttering browser history

## Implementation
- `useEffect` syncs `window.location.hash` when `activeTab.path` changes
- `useEffect` reads hash on mount (after workspace restore) and opens note
- `popstate` listener handles browser back/forward navigation
- 100ms delay ensures hash is read after workspace restoration completes

## Files changed
- `packages/web/src/App.tsx` — two new useEffect hooks for hash sync and hash reading
