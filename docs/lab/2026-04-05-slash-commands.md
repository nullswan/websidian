# Slash Commands

**Date**: 2026-04-05
**Status**: Complete

## What was built

### Slash command menu in editor
- Type `/` at start of line to get autocomplete dropdown
- 16 commands: headings (1-4), bullet/numbered/task lists, quote, code block, callout, table, horizontal rule, math block, link, image, embed
- Filter by typing after `/` (e.g. `/hea` shows heading options)
- Selecting a command replaces the `/` with markdown syntax

## Key technical decisions
- **Reuses CM6 autocompletion**: Slash completion is a `CompletionSource` alongside wikilink and tag completions. No custom dropdown needed.
- **Line-start only**: Regex `^/(\w*)$` ensures slash commands only trigger at the start of a line, not in the middle of text.
- **Full line replacement**: `from = line.from` replaces the entire `/` prefix with the inserted syntax.

## Files changed
- `packages/web/src/components/Editor.tsx` — `slashCompletion` function, added to autocompletion override
