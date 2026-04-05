# Editor Heading Section Folding

**Date**: 2026-04-05
**Status**: Complete

## What was built

### Foldable heading sections in Live Preview
- Clicking a fold gutter arrow on a heading line collapses all content until the next heading of equal or higher level
- Fold gutter shows `▾` (expanded) / `▸` (collapsed) arrows with hover brightening
- Fold placeholder renders as purple-tinted `...` pill
- Keyboard shortcuts: Ctrl+Shift+[ to fold, Ctrl+Shift+] to unfold (from CM6 foldKeymap)
- Works for all heading levels (h1 through h6), respects heading hierarchy

## Key technical decisions
- **`foldService` facet**: Custom callback `(state, lineStart) => {from, to} | null` — checks if the line starts with `#{1,6}\s`, then scans forward to find the next heading of same or higher level
- **Fold range**: `from` = end of heading line (`line.to`), `to` = end of last content line before next heading — preserves heading text while hiding body
- **Three extensions**: `codeFolding()` manages fold state + placeholder, `markdownHeadingFold` provides the fold ranges, `foldGutter()` renders interactive arrows
- **`markerDOM` callback**: Custom DOM creation for gutter markers with hover event listeners for opacity/color transitions

## Files changed
- `packages/web/src/components/Editor.tsx` — imports (foldService, foldGutter, codeFolding, foldKeymap), markdownHeadingFold service, fold gutter config, theme styles for fold gutter and placeholder
