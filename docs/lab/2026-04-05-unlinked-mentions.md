# Unlinked Mentions

**Date**: 2026-04-05
**Status**: Complete

## What was built

### Unlinked mentions panel in right sidebar
- New "Unlinked Mentions" SidebarSection below Backlinks
- Shows notes that contain the current note's title as plain text (not inside [[wikilinks]])
- Grouped by source note with line-level context snippets (max 3 per note)
- "Link" button per note: converts all bare title mentions to [[wikilinks]] via regex replace
- After linking, backlinks automatically refresh to reflect the change

## Key technical decisions
- **Server-side scanning**: Added to existing `/api/vault/backlinks` response to avoid extra API call
- **Wikilink exclusion**: Server checks each matching line — if the match appears inside `[[...]]`, it's skipped
- **Minimum title length**: Only searches for titles >= 2 characters to avoid noise
- **Word boundary regex on client**: "Link" button uses `\b` + negative lookbehind/lookahead to avoid double-linking
- **Regex escaping**: Note titles are properly escaped before building regex patterns

## Files changed
- `packages/server/src/routes/vault.ts` — added unlinkedMentions to backlinks response
- `packages/web/src/App.tsx` — UnlinkedMention interface, Tab field, sidebar section with Link button
