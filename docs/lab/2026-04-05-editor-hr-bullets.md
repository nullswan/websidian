# Horizontal Rule & Bullet Widgets in Editor

**Date**: 2026-04-05
**Status**: Complete

## What was built

### Bullet dot rendering
- `- ` list markers replaced with purple `•` on non-active lines
- Checkbox lines (`- [ ]`, `- [x]`) excluded via negative lookahead
- Indented lists preserve whitespace prefix
- Raw `- ` revealed when cursor moves to the line

### Horizontal rule rendering
- `---`, `***`, `___` (and with extra chars) replaced with visual `<hr>` element
- Frontmatter `---` delimiters excluded (skips lines within frontmatter range)
- Raw syntax revealed on cursor line

## Key technical decisions
- **Combined StateField**: HR and bullet widgets share one `livePreviewWidgetsField` to avoid proliferating fields
- **Frontmatter skip**: Reuses `parseFrontmatterRange()` to find the frontmatter boundary and skip those lines
- **Bullet negative lookahead**: `(?!\[[ x]\])` prevents double-decoration with checkbox field

## Files changed
- `packages/web/src/components/Editor.tsx` — HRWidget, BulletWidget, buildLivePreviewDecorations, livePreviewWidgetsField
