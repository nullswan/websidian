# Editor Mermaid Diagram Rendering

**Date**: 2026-04-05
**Status**: Complete

## What was built

### Mermaid diagram rendering in Live Preview editor
- ```mermaid code blocks render as SVG diagrams on non-active blocks
- Uses the same mermaid library as reader view
- Async rendering with error handling
- Cursor inside block reveals raw mermaid syntax for editing
- Styled container with subtle background and border

## Key technical decisions
- **MermaidWidget in toDOM()**: Async `mermaid.render()` call, injects SVG into container
- **Integrated into codeBlockField**: Special case for `lang === "mermaid"` uses `Decoration.replace()` with block=true
- **Full block replacement**: Unlike regular code blocks (line decorations), mermaid replaces the entire ```...``` range

## Files changed
- `packages/web/src/components/Editor.tsx` — MermaidWidget class, mermaid import, mermaid branch in buildCodeBlockDecorations
