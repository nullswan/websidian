# Editor Code Block Styling

**Date**: 2026-04-05
**Status**: Complete

## What was built

### Fenced code block Live Preview in CM6 editor
- Code blocks (```lang ... ```) get styled background on non-active lines
- Language label appears in top-right corner (e.g. "JAVASCRIPT", "PYTHON")
- Subtle border-top/bottom and rounded corners on block boundaries
- Monospace font applied to all code block lines
- Active cursor inside block reveals raw markdown for editing

## Key technical decisions
- **StateField pattern**: Consistent with other Live Preview fields — cursor-aware show/hide
- **Line decorations**: `Decoration.line()` for per-line background, font, and border styling
- **Inline widget for label**: Widget appended at end of opening fence line, absolutely positioned right
- **Fence detection**: Regex scan with variable fence length (3+ backticks), finds matching close

## Files changed
- `packages/web/src/components/Editor.tsx` — CodeBlockLabelWidget, buildCodeBlockDecorations, codeBlockField
