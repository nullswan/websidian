# Mermaid Diagrams & Block Ref Hiding

**Date**: 2026-04-04
**Status**: Complete

## What was built

### Mermaid diagram rendering
- `\`\`\`mermaid` code blocks render as interactive SVG diagrams
- Uses mermaid.js with dark theme, initialized with `startOnLoad: false`
- Diagram hydration via useEffect in Reader component (async render)
- Graceful error handling for invalid diagram syntax

### Block reference hiding
- `^block-id` markers stripped from rendered text
- Core rule in markdown renderer removes `\s*\^[\w-]+$` from text tokens

## Implementation
- Markdown `highlight` function detects `lang === "mermaid"` and outputs a placeholder div
- Reader useEffect finds `.mermaid-placeholder` elements and calls `mermaid.render()`
- Each diagram gets a unique ID to avoid conflicts
- Block refs stripped via `md.core.ruler.push("block_refs", ...)`

## Files changed
- `packages/web/src/lib/markdown.ts` — mermaid placeholder in highlight, block ref stripping rule
- `packages/web/src/components/Reader.tsx` — mermaid hydration effect, mermaid import
- `fixtures/test-vault/Concepts.md` — added Diagrams section with flowchart
