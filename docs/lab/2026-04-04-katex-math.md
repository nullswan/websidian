# KaTeX Math Rendering

**Date**: 2026-04-04
**Status**: Complete

## What was built
- Inline math `$...$` renders with KaTeX (e.g., $E = mc^2$)
- Display math `$$...$$` renders centered in display mode
- Multi-line display math blocks supported
- Graceful fallback: renders as `<code>` if KaTeX parsing fails

## Implementation
- Custom `mathInlineRule` for `$...$` (inline parser, runs after escape)
- Custom `mathBlockRule` for `$$...$$` (block parser, runs after fence)
- Both use `katex.renderToString()` with `throwOnError: false`
- KaTeX CSS imported in App.tsx
- No third-party markdown-it plugin — hand-written rules consistent with existing patterns

## Test content
- Added Math section to `fixtures/test-vault/Concepts.md`
- Includes inline (E=mc^2, summation), display (Gaussian integral, Newton's law)

## Files changed
- `packages/web/src/lib/markdown.ts` — added math inline/block rules and renderers
- `packages/web/src/App.tsx` — imported katex.min.css
- `fixtures/test-vault/Concepts.md` — added Math section
- `packages/web/package.json` — added katex dependency
