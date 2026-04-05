# Blockquote Left-Border in Editor Live Preview

**Date**: 2026-04-05
**Status**: Complete

## What was built

### Blockquote visual styling in editor
- Lines starting with `>` get a purple left border (3px solid)
- Text styled italic + muted color matching Obsidian's appearance
- `>` markers hidden on non-active lines (zero-width widget)
- Supports nested blockquotes (depth 2-3 get increasing left margin)
- Works with callout syntax — `> [!type]` lines styled consistently

## Key technical decisions
- **Line + inline decoration combo**: `Decoration.line()` for the border, `Decoration.replace()` for hiding the `>` marker
- **Zero-width widget**: `BlockquoteMarkerWidget` renders as `width: 0; overflow: hidden` to hide the marker without affecting document positions
- **Integrated into livePreviewWidgetsField**: Added to the existing shared StateField alongside HR and bullet decorations, avoiding a separate field

## Files changed
- `packages/web/src/components/Editor.tsx` — BlockquoteMarkerWidget, blockquote detection in buildLivePreviewDecorations, cm-blockquote CSS in livePreviewTheme
