# Search Result Scroll-to-Line

**Date**: 2026-04-05
**Status**: Complete

## What was built

### Click search match to scroll to line
- Clicking a specific match line in search results opens the note and scrolls to that approximate position
- Line number passed from SearchPanel through App to Reader via `scrollToLine` prop
- Reader uses ratio-based scroll: `(line - 1) / totalLines * scrollHeight`
- Smooth scroll animation via `scrollTo({ behavior: "smooth" })`
- ScrollToLine state auto-clears after scroll completes

## Key technical decisions
- **Ratio-based approximation**: Since markdown-it doesn't preserve source line mappings in rendered HTML, we use the source line ratio as a fraction of total scroll height. This works well for proportionally-rendered content.
- **Walk-up scroller discovery**: `ScrollToLineEffect` walks up the DOM tree to find the first element with `scrollHeight > clientHeight`, handling varying layout configurations.
- **Separate component**: `ScrollToLineEffect` is a null-rendering component that handles the scroll side effect, keeping Reader clean.

## Files changed
- `packages/web/src/components/SearchPanel.tsx` — passes `m.line` as third arg to `onNavigate`
- `packages/web/src/components/Reader.tsx` — `scrollToLine`/`onScrollToLineDone` props, `ScrollToLineEffect` component
- `packages/web/src/App.tsx` — `scrollToLine` state, wired to SearchPanel and Reader
