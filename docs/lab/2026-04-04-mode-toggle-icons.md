# Mode Toggle Icons

**Date**: 2026-04-04
**Status**: Complete

## What was built
Replaced the two-button "Read"/"Edit" text toggle with a single Obsidian-style icon button:
- Book icon (open book SVG) when in reading view
- Pen/pencil icon (pencil SVG) when in editing view
- Click toggles between modes
- Tooltip shows current action + shortcut (Ctrl+E)
- Positioned at top-right of tab bar, matching Obsidian's layout

## Design
- Single button vs two-state toggle group — matches Obsidian's UX pattern
- Icon reflects current mode ("tool in hand" mental model)
- Subtle hover state with background highlight
- 28x28px touch target with 18x18px SVG icons

## Files changed
- `packages/web/src/App.tsx` — replaced mode-toggle div with single .mode-toggle-btn
- `packages/web/src/styles.css` — replaced .mode-toggle styles with .mode-toggle-btn styles
