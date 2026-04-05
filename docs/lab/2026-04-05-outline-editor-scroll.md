# Outline Click-to-Scroll in Editor Mode

**Date**: 2026-04-05
**Status**: Complete

## What was built

### Outline scroll in both modes
- Clicking an outline heading in reader mode scrolls the `.reader-view` heading into view (existing behavior)
- Clicking in editor mode now uses CM6's `EditorView.scrollIntoView` to scroll to the heading line
- Active heading highlight in outline sidebar works in both modes

## Key technical decisions
- **Ref-based function passing**: `scrollToHeadingRef` prop on Editor — a `MutableRefObject` populated with a `(heading, level) => void` function after view creation. Avoids `forwardRef`/`useImperativeHandle`.
- **CM6 document search**: Iterates `doc.lines` with a regex matching `^#{level} heading$` — works regardless of whether the line is currently rendered in the viewport (CM6 virtualizes off-screen lines)
- **`EditorView.scrollIntoView` with `y: "start"`**: Scrolls the heading to the top of the editor viewport

## Why DOM scrollIntoView failed
CM6 virtualizes lines — only visible lines exist as `.cm-line` DOM elements. Headings below the viewport aren't in the DOM, so `document.querySelectorAll('.cm-line')` can't find them. The fix uses CM6's document model which always contains all lines.

## Files changed
- `packages/web/src/components/Outline.tsx` — `onScrollToHeading` callback prop, fallback to callback when reader headings not found
- `packages/web/src/components/Editor.tsx` — `scrollToHeadingRef` prop, populated after view creation with regex-based heading search
- `packages/web/src/App.tsx` — ref creation, wiring between Editor and Outline
