# Editor Block Ref Hiding + Active Line Gutter

**Date**: 2026-04-05
**Status**: Complete

## What was built

### Block reference ID hiding
- `^block-id` markers at end of lines hidden on non-active lines
- Leading space before ^block-id also hidden for clean appearance
- Active line reveals raw ^block-id for editing

### Active line number highlight
- Current line number in gutter colored with accent purple (#7f6df2)
- Subtle purple background (8% opacity) on active gutter element
- Uses CM6's built-in `.cm-activeLineGutter` class

## Files changed
- `packages/web/src/components/Editor.tsx` — block ref regex in buildInlineMarkerDecorations, .cm-activeLineGutter theme
