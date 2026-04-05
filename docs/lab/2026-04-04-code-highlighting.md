# Code Syntax Highlighting

**Date**: 2026-04-04
**Status**: Complete

## What was built
- Fenced code blocks get syntax highlighting via highlight.js
- Supports: javascript, typescript, python, css, json, bash, yaml, markdown, html/xml, sql, rust, go
- Uses `highlight.js/lib/core` with selective imports for small bundle
- GitHub Dark theme for consistent dark UI appearance

## Implementation
- Registered language aliases: js, ts, py, sh, shell, yml, md, html
- Set markdown-it `highlight` option to call `hljs.highlight()`
- Falls back to default escaping for unknown languages
- Imported `highlight.js/styles/github-dark.css` in App.tsx

## Files changed
- `packages/web/src/lib/markdown.ts` — imported hljs core + 12 languages, set highlight option
- `packages/web/src/App.tsx` — imported github-dark.css
- `fixtures/test-vault/Concepts.md` — added Code section with JS and Python examples
