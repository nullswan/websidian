# Lab Note: Performance + Theme Consistency Pass

**Date:** 2026-04-06
**Scope:** React.memo wrapping, CSS variable color migration

## React.memo

Added `React.memo` to 8 sidebar/utility components that re-render unnecessarily
when parent App state changes (e.g., typing in editor triggers full sidebar
re-render chain):

- ScrollContainer, StatusBar, SidebarSection (prior commit)
- Backlinks, LocalGraph, Properties, OutgoingLinks, WordFrequency (this session)

These components receive props that rarely change but sit in a render tree
under the 4800-line App component. Memo prevents re-renders when props are
referentially stable.

## Color Variable Migration

Replaced ~70 hardcoded hex colors across 17 files with 4 semantic CSS variables:

| Variable | Dark | Light | Used for |
|---|---|---|---|
| `--color-green` | #4ec9b0 | #2e8b57 | Success, completion, added |
| `--color-red` | #e05252 | #c0392b | Error, deletion, danger |
| `--color-orange` | #e6994a | #d4820a | Warning, saving, highlights |
| `--color-yellow` | #e5c07b | #b8860b | Medium-grade, streak |

Previously had two competing green palettes (#4ec9b0 Obsidian teal + #4caf50
Material green) and two reds (#e05252 + #f44336). Now unified under single
tokens.

Intentionally left ~42 hex colors in Editor.tsx (CM6 syntax highlighting),
Graph.tsx (node colors), and FileTree.tsx (file type icons) — these are
decorative colors that don't need theme adaptation.

## Commits

- `85c07ad` perf: add React.memo to 5 sidebar components, migrate hardcoded colors to CSS variables
- `1ead518` style: migrate remaining #4caf50/#f44336 hardcoded colors to CSS variables
