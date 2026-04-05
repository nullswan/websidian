# Breadcrumb Navigation

**Date**: 2026-04-05
**Status**: Complete

## What was built
- Breadcrumb bar showing the current file's path as clickable segments above the content area
- Path segments separated by `›` character, e.g. "Projects › Project Alpha"
- Folder segments highlight on hover and switch to the files panel when clicked
- Final segment (file name) shown in lighter color, non-clickable
- `.md` extension stripped from display

## Implementation
- Inline breadcrumb rendering in `renderPaneContent` between tab bar and ScrollContainer
- Path split by `/` with `.md` suffix removed
- Hover color change via inline `onMouseEnter`/`onMouseLeave` handlers
- Clicking a folder segment sets `leftPanel` to "files" for orientation
- Styled with subtle border-bottom separator, 11px font, muted colors

## Files changed
- `packages/web/src/App.tsx` — added breadcrumb div in renderPaneContent
