# Backlink Context Snippets

**Date**: 2026-04-05
**Status**: Complete

## What was built

### Line-level context in backlinks panel
- Each backlink now shows the actual source line containing the wikilink reference
- Multiple references from the same note are listed separately (e.g., Welcome.md linking 3 times to Concepts.md shows 3 entries)
- Context text has wikilink syntax stripped: `[[target|display]]` → `display`, `[[target]]` → `target`
- Context snippets styled with a 2px left border, dim text, ellipsis overflow

### Server changes
- Backlinks endpoint reads source file content to extract line text at the link's line number
- Lazy content cache (`Map<string, string[]>`) prevents re-reading the same file for multiple links
- Removed `break` statement so all occurrences per source note are returned

### Frontend changes
- Backlinks component groups entries by source note path
- Each source note shows its name as a clickable link, with context snippets below
- `lineContext` field preferred over `context` (link display text) as fallback

## Key technical decisions
- **Lazy file reading with cache**: Only reads source files when a backlink is found, caches line arrays per path to avoid re-reading for multiple links from the same file
- **Line number from parser**: WikiLink interface already tracks 1-based line numbers, so no re-parsing needed
- **Grouped display**: `Map<string, entries[]>` groups by path, then renders each group with note name + context list — matches Obsidian's backlinks panel

## Files changed
- `packages/server/src/routes/vault.ts` — lineContext extraction, content cache, removed break
- `packages/web/src/components/Backlinks.tsx` — grouped rendering, context snippet display
- `packages/web/src/App.tsx` — BacklinkEntry interface updated with lineContext
