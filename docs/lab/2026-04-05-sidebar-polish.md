# Sidebar Polish & Small Fixes

**Date**: 2026-04-05
**Status**: Complete

## What was built
- Obsidian-style icon ribbon (44px) with file explorer, search, graph, plugins icons
- Sidebar collapse: click active ribbon icon to toggle panel visibility
- Right sidebar collapse via Ctrl+Shift+\ and command palette
- Collapse state persisted in workspace localStorage
- File tree folder expanded/collapsed state persisted in localStorage
- Frontmatter Properties widget fix: cursor positioned past frontmatter on async load
- Wikilink display: shows basename only (not full path) in reader view
- Tab close buttons hidden by default, visible on hover (Obsidian behavior)
- File tree hover states with rounded corners and subtle transitions

## Key technical decisions
- Ribbon collapse: clicking same icon collapses, clicking different icon switches panel + expands
- File tree expanded state: uses Set<string> of folder paths, serialized to JSON in localStorage
- First visit: all folders default to expanded (no saved state means full expansion)
- Frontmatter async fix: dispatch selection alongside content changes to move cursor past YAML

## Files changed
- `packages/web/src/App.tsx` — ribbon, sidebar collapse, right sidebar toggle, keyboard shortcuts
- `packages/web/src/components/FileTree.tsx` — folder persistence, hover states
- `packages/web/src/components/Editor.tsx` — cursor positioning on async content
- `packages/web/src/lib/markdown.ts` — wikilink basename display
- `packages/web/src/styles.css` — tab bar, tab close, sidebar refinements
