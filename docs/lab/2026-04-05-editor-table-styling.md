# Editor Table Styling

**Date**: 2026-04-05
**Status**: Complete

## What was built

### Table styling in Live Preview editor
- Markdown tables (`| Col | Col |`) get styled background on non-active lines
- Header row: 6% white background + bold text
- Separator row: dimmed color + smaller font
- Data rows: alternating striped backgrounds
- Monospace font for table content (alignment clarity)
- Cursor inside table reveals raw syntax

## Key technical decisions
- **Line decoration approach**: Tables stay editable, only visual styling added
- **Two-line detection**: Header line + separator line (`| --- |`) required to confirm table
- **Forward scanning**: Finds all consecutive `|...|` rows after separator
- **Even/odd striping**: Subtle alternating background for data rows

## Files changed
- `packages/web/src/components/Editor.tsx` — buildTableDecorations, tableField, cm-table-line theme styles
