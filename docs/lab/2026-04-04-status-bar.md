# Status Bar

**Date**: 2026-04-04
**Status**: Complete

## What was built
- Obsidian-style status bar at the bottom of the editor area
- Shows: file name, word count, character count, estimated reading time
- Updates reactively when content changes or tabs switch
- Strips frontmatter before counting

## Implementation
- New `StatusBar` component with `useMemo` for stats computation
- 200 WPM reading speed estimate, minimum 1 minute
- Positioned via flex layout at bottom of main content column

## Files changed
- `packages/web/src/components/StatusBar.tsx` — new component
- `packages/web/src/App.tsx` — import and render StatusBar below panes
