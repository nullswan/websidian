# Heading Hash Hiding in Editor Live Preview

**Date**: 2026-04-05
**Status**: Complete

## What was built

### Heading marker hiding
- `#` markers on heading lines (H1-H6) hidden on non-active lines
- Raw `# ` syntax revealed when cursor moves to the heading line
- Sized heading text preserved via existing `obsidianHighlight` HighlightStyle
- Works with all heading levels (1-6)

## Key technical decisions
- **Decoration.replace with zero-width widget**: `HeadingMarkerWidget` renders as `width: 0; display: inline-block; overflow: hidden` — same pattern as `BlockquoteMarkerWidget`
- **Regex match**: `^(#{1,6})\s` captures the full hash prefix including trailing space
- **Integrated into buildLivePreviewDecorations**: Added before HR/bullet/blockquote checks, with `continue` to skip further matching on heading lines

## Files changed
- `packages/web/src/components/Editor.tsx` — HeadingMarkerWidget class, heading detection in buildLivePreviewDecorations
