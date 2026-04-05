# Export Note as HTML

**Date**: 2026-04-05
**Status**: Complete

## What was built

### Export current note as standalone HTML
- Command palette: "Export current note as HTML"
- Renders markdown content using existing markdown-it renderer
- Generates self-contained HTML file with inlined dark theme CSS
- Triggers browser download with `<title>.html` filename
- Includes styling for headings, code, tables, blockquotes, tags, marks

## Key technical decisions
- **Blob URL download**: `URL.createObjectURL()` + programmatic `<a>` click for browser-native download
- **Inlined CSS**: All styles embedded in `<style>` tag — no external dependencies, works offline
- **Reuses markdown renderer**: Same `createMarkdownRenderer()` as reader view for consistent output

## Files changed
- `packages/web/src/App.tsx` — exportAsHtml callback, command palette entry, markdown import
