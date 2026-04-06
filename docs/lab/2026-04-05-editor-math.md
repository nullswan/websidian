# Editor Math Rendering

**Date**: 2026-04-05
**Status**: Complete

## What was built

### LaTeX math rendering in Live Preview editor
- `$inline$` renders as formatted KaTeX math on non-active lines
- `$$display$$` renders as centered block math on non-active lines
- Active line reveals raw LaTeX for editing
- Multi-line display math supported (shows raw on cursor in any line)
- Invalid LaTeX shows KaTeX error rendering gracefully

## Key technical decisions
- **MathWidget with KaTeX**: Renders LaTeX to HTML in widget's `toDOM()` method
- **Two-pass regex**: Display math `$$` scanned first, then inline `$` with negative lookahead
- **StateField pattern**: Consistent with other Live Preview fields (images, checkboxes, bullets)
- **Multi-line cursor check**: Display math block shows raw if cursor is on ANY line within

## Files changed
- `packages/web/src/components/Editor.tsx` — MathWidget, buildMathDecorations, mathField
