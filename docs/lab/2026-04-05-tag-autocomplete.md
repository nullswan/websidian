# Tag Autocomplete in Editor

**Date**: 2026-04-05
**Status**: Complete

## What was built

### Tag completion dropdown
- Typing `#` in the CM6 editor triggers a completion dropdown showing all vault tags
- Each option shows the tag name and usage count (e.g. "concept 2")
- Filters as you type after `#` (e.g. `#con` narrows to "concept")
- Heading lines (`# Title`) excluded — only triggers on inline tag context
- Works alongside existing wikilink autocomplete (`[[`)

## Key technical decisions
- **CM6 `autocompletion` override array**: Both `wikilinkCompletion` and `tagCompletion` coexist in the same `override` array — CM6 calls each and merges results
- **Regex guard**: `/#([\w\-/]*)$/` matches the `#` prefix plus partial tag text; `/^#{1,6}\s/` rejects heading lines to avoid false triggers
- **Server-side fetch**: Hits `/api/vault/tags` on each trigger (debounced by CM6's built-in 100ms delay), returns up to 20 filtered results
- **`filter: false`**: Client-side filtering done manually before returning options, so CM6 doesn't double-filter

## Files changed
- `packages/web/src/components/Editor.tsx` — `tagCompletion` function + added to autocompletion override array
