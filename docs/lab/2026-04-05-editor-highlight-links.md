# Editor Highlight & External Link Rendering

**Date**: 2026-04-05
**Status**: Complete

## What was built

### Highlight background in Live Preview
- `==text==` gets yellow background (rgba(255, 208, 0, 0.3)) on non-active lines
- Works alongside existing marker hiding from inlineMarkerField
- Mark decoration (not replace) preserves the visible text

### External link rendering in Live Preview
- `[text](url)` renders as styled purple link text with ↗ arrow on non-active lines
- Links are clickable (`<a>` with target="_blank")
- Image links `![...]` excluded via negative lookbehind
- Active line reveals raw markdown syntax

## Key technical decisions
- **Combined StateField**: Both highlight and links computed in single pass for efficiency
- **Mark vs Replace**: Highlight uses `Decoration.mark()` to style existing text, links use `Decoration.replace()` with widget
- **ExternalLinkWidget with `<a>` tag**: Real link element enables native click behavior without custom event handling

## Files changed
- `packages/web/src/components/Editor.tsx` — ExternalLinkWidget, buildHighlightAndLinkDecorations, highlightAndLinkField
