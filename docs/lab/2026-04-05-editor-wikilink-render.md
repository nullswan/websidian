# Editor Wikilink Rendering

**Date**: 2026-04-05
**Status**: Complete

## What was built

### Wikilink Live Preview rendering in CM6 editor
- `[[Note]]` renders as styled purple "Note" link text on non-active lines
- `[[path/Note|Display]]` renders as "Display" (alias takes priority)
- `[[path/Note]]` shows basename only ("Note"), stripping path and heading
- Subtle underline with 30% opacity accent color
- Hover title shows full target path
- Embed lines (`![[...]]`) excluded (handled by other fields)
- Active line reveals raw `[[...]]` syntax for editing

## Key technical decisions
- **Inline replace decoration**: Each `[[...]]` span replaced with `WikilinkWidget`
- **Separate StateField**: Not merged into inlineMarkerField since wikilinks need custom widget (not zero-width)
- **Multiple per line**: Regex scan with global flag handles multiple wikilinks on same line
- **Basename extraction**: `target.split("/").pop()` strips path prefix for clean display

## Files changed
- `packages/web/src/components/Editor.tsx` — WikilinkWidget, buildWikilinkDecorations, wikilinkRenderField
