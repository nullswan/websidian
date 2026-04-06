# Editor Note Embed Preview

**Date**: 2026-04-05
**Status**: Complete

## What was built

### Embedded note preview in Live Preview editor
- `![[note]]` renders as inline bordered preview box on non-active lines
- `![[note#heading]]` extracts and renders just the heading section
- Purple left border + tinted background matching reader view embed style
- Async content fetching with loading state and error handling
- Frontmatter stripped from preview
- Long content truncated at 1500 chars
- Image embeds excluded (handled by existing imagePreviewField)

## Key technical decisions
- **Async toDOM()**: Widget renders loading placeholder, fetches note content, then replaces innerHTML
- **StateField as closure**: Created inside useEffect to capture `filePath` prop for resolve API
- **createMarkdownRenderer per render**: Each embed gets its own renderer instance for isolation
- **Heading section extraction**: Parses heading levels to find section boundaries

## Files changed
- `packages/web/src/components/Editor.tsx` — NoteEmbedWidget, buildNoteEmbedDecorations, noteEmbedField
