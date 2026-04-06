# Editor Footnote Rendering

**Date**: 2026-04-05
**Status**: Complete

## What was built

### Footnote rendering in Live Preview editor
- `[^1]` inline references render as purple superscript numbers
- Named footnotes `[^note]` mapped to sequential numbers
- Footnote definitions `[^1]: text` styled as dimmed footer with top border
- Definition label replaced with numbered prefix ("1.", "2.")
- Active line reveals raw syntax for editing

## Key technical decisions
- **Two-pass approach**: First pass collects definition labels to build number mapping, second pass applies decorations
- **Superscript widget**: `<sup>` element for proper baseline positioning
- **Definition styling**: Line decoration with border-top separates footnotes from content

## Files changed
- `packages/web/src/components/Editor.tsx` — FootnoteRefWidget, buildFootnoteDecorations, footnoteField
