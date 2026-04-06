# Heading Autocomplete in Wikilinks

**Date**: 2026-04-05
**Status**: Complete

## What was built

### [[Note#heading dropdown
- Typing `[[NoteName#` shows a dropdown of all headings in that note
- Headings filtered by text after `#` (fuzzy match)
- Selecting a heading inserts `[[NoteName#Heading]]` with closing brackets
- Two-phase: resolve note path → fetch content → extract `#{1,6}` headings

## Implementation
- Extended `wikilinkCompletion` to detect `#` in query
- Split query at `#`: note name (before) and heading filter (after)
- Uses existing `/api/vault/resolve` and `/api/vault/file` endpoints
- `from` position set to after `#` so only heading text is replaced

## Files changed
- `packages/web/src/components/Editor.tsx` — extended wikilinkCompletion function
