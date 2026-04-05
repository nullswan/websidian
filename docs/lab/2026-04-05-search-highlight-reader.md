# Search Match Highlighting in Reader

**Date**: 2026-04-05
**Status**: Complete

## What was built
- When navigating to a note from search results, matching text is highlighted in orange in the reader view
- First match is auto-scrolled into view with smooth scrolling
- Highlights are automatically cleared when navigating via wikilinks, file tree, or other non-search paths

## Implementation
- Added `searchHighlight` prop to `Reader` component
- Post-render `useEffect` walks text nodes with `TreeWalker`, finds matches, and wraps them in `<mark class="search-highlight">` elements using `Range.surroundContents`
- Matches iterated in reverse order to keep text node indices stable during wrapping
- Cleanup phase replaces existing `<mark>` elements with text nodes and calls `normalize()` to merge fragments
- `SearchPanel.onNavigate` now passes the query string alongside the path
- `openTab` clears `readerHighlight` state by default; search panel re-sets it after

## Files changed
- `packages/web/src/components/Reader.tsx` — added `searchHighlight` prop and highlight effect
- `packages/web/src/components/SearchPanel.tsx` — `onNavigate` now accepts optional query param
- `packages/web/src/App.tsx` — added `readerHighlight` state, threading query through search→reader
