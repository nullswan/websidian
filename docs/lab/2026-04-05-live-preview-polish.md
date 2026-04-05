# Live Preview Polish & Code Block Enhancements

**Date**: 2026-04-05
**Status**: Complete

## What was built

### Editor Live Preview — marker hiding
- **Heading hash hiding**: `#` markers hidden on non-active lines via zero-width `HeadingMarkerWidget`
- **Bold/italic marker hiding**: `**`/`*` hidden via Lezer `EmphasisMark` tree nodes
- **Inline code backtick hiding**: `` ` `` hidden via Lezer `CodeMark` tree nodes
- **Strikethrough/highlight hiding**: `~~`/`==` hidden via regex (not in Lezer tree)
- **Numbered list rendering**: `1.` `2.` etc. replaced with purple styled `NumberedListWidget`
- All markers revealed when cursor moves to the line

### Reader view — code block enhancements
- **Copy button**: hover-to-show "Copy" button in top-right, copies code with "Copied!" feedback
- **Language label**: uppercase language name (JAVASCRIPT, PYTHON) in top-left from `language-*` class

### Zen mode
- `Ctrl+Shift+Z` toggles distraction-free writing
- Hides ribbon, sidebars, tab bar, status bar
- `Escape` exits, restoring prior sidebar collapsed states
- Command palette and shortcuts overlay entries

## Key technical decisions
- **Hybrid inline marker approach**: EmphasisMark/CodeMark from syntax tree for reliable delimiter detection, regex for `~~`/`==` which aren't in the Lezer tree
- **Sorted range merge**: Collects all marker positions (tree + regex), sorts by document order, feeds to `RangeSetBuilder`
- **Separate StateField**: `inlineMarkerField` independent from line-level `livePreviewWidgetsField`
- **Zen mode ref-based state save**: `useRef` stores pre-zen sidebar collapsed states to avoid stale closures
- **Reader hydration pattern**: Copy buttons and language labels added via DOM manipulation in `useEffect`, not React JSX

## Files changed
- `packages/web/src/components/Editor.tsx` — HeadingMarkerWidget, InlineMarkerWidget, NumberedListWidget, buildInlineMarkerDecorations, inlineMarkerField
- `packages/web/src/components/Reader.tsx` — code block copy buttons, language labels
- `packages/web/src/App.tsx` — zen mode state, toggleZenMode, Ctrl+Shift+Z shortcut, conditional hiding
