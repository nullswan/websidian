# Editor Tag Pill Rendering

**Date**: 2026-04-05
**Status**: Complete

## What was built

### Tag pill rendering in Live Preview editor
- `#tag` renders as styled orange pill/badge on non-active lines
- Nested tags supported (`#parent/child`)
- Heading lines excluded (# is heading marker, not tag)
- Active line reveals raw `#tag` syntax for editing

## Key technical decisions
- **Regex with word boundary**: `(?:^|\s)#([\w\-/]+)` matches tags after whitespace or line start
- **Orange accent**: Matches Obsidian's tag color (#e6994a) with 15% opacity background
- **Separate StateField**: Keeps tag detection isolated from other inline marker logic

## Files changed
- `packages/web/src/components/Editor.tsx` — TagPillWidget, buildTagDecorations, tagRenderField
