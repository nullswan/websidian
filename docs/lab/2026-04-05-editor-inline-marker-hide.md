# Inline Marker Hiding in Editor Live Preview

**Date**: 2026-04-05
**Status**: Complete

## What was built

### Bold/italic/strikethrough/highlight marker hiding
- `**`, `*` (bold/italic) markers hidden on non-active lines via Lezer syntax tree `EmphasisMark` nodes
- `~~` (strikethrough) markers hidden via regex scan
- `==` (highlight) markers hidden via regex scan
- Raw syntax revealed when cursor moves to the line
- Formatted text (bold, italic, strikethrough) still styled via HighlightStyle

## Key technical decisions
- **Hybrid approach**: EmphasisMark from syntax tree for `**`/`*` (reliable, handles nesting), regex for `~~`/`==` (not in Lezer tree)
- **Separate StateField**: `inlineMarkerField` keeps inline decorations independent from line-level `livePreviewWidgetsField`
- **Sorted merge**: Collects all ranges (tree + regex), sorts by position, then builds DecorationSet — required since `RangeSetBuilder` demands document order
- **Shared widget instance**: Single `inlineMarkerWidget` reused for all markers (zero-width, stateless)

## Files changed
- `packages/web/src/components/Editor.tsx` — InlineMarkerWidget, buildInlineMarkerDecorations, inlineMarkerField
