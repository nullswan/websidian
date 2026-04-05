# Footnotes

**Date**: 2026-04-04
**Status**: Complete

## What was built
- `[^1]` inline footnote references with superscript styling
- `[^1]: definition` blocks rendered at page bottom with separator
- Named footnotes (`[^note]`) supported
- Back-reference arrows for navigation
- Markdown rendering inside footnote definitions

## Implementation
- Used `markdown-it-footnote` plugin (v4)
- Plugin integrated via `md.use(footnotePlugin)` in createMarkdownRenderer
- Styled `.footnotes-sep`, `.footnotes-list`, `.footnote-ref`, `.footnote-backref` in CSS

## Files changed
- `packages/web/src/lib/markdown.ts` — imported and registered footnote plugin
- `packages/web/src/styles.css` — footnote styles (separator, list, refs, backrefs)
- `fixtures/test-vault/Concepts.md` — added Footnotes section with numbered and named examples
- `packages/web/package.json` — added `markdown-it-footnote` dependency
