# Editor Callout Rendering

**Date**: 2026-04-05
**Status**: Complete

## What was built

### Callout blocks in Live Preview editor
- `> [!type] Title` renders as styled callout box in editor
- Colored left border + tinted background matching callout type
- Icon + title header replaces the raw `> [!type]` syntax on non-active lines
- Continuation lines (`>` after header) get same styling
- All 25 callout types supported (note, warning, tip, danger, etc.)
- Active line reveals raw syntax for editing

## Key technical decisions
- **Forward-scanning block detection**: Scans from callout header to find all continuation `>` lines
- **Dynamic inline styles**: `Decoration.line({ attributes: { style: ... } })` for per-type colors
- **Shared color/icon maps**: CALLOUT_COLORS and CALLOUT_ICONS exported from markdown.ts
- **CalloutHeaderWidget**: Renders icon + title, hides raw `> [!type]` syntax

## Files changed
- `packages/web/src/components/Editor.tsx` — CalloutHeaderWidget, callout detection in buildLivePreviewDecorations
- `packages/web/src/lib/markdown.ts` — exported CALLOUT_COLORS and CALLOUT_ICONS
