# Light Theme Phase 2 — Full App Shell

**Date**: 2026-04-05
**Status**: Complete

## What was built

### Full light/dark theme across all UI components
- Migrated ~120 hardcoded hex colors to CSS custom properties
- App.tsx: ribbon, sidebar, tab bar, status bar, breadcrumbs, dividers, context menus, modals
- Settings.tsx: extracted `inputStyle` object, all colors via CSS vars
- Components themed: SearchPanel, FileTree, CommandPalette, QuickSwitcher, StatusBar, Backlinks, Outline, Tags, Snippets, Plugins, LoginPage, WorkspaceManager

### Color mapping
| Hex value | CSS Variable |
|-----------|-------------|
| #1e1e1e | --bg-primary |
| #252526 | --bg-secondary |
| #2a2a2a | --bg-tertiary |
| #37373d | --bg-hover |
| #333, #444 | --border-color |
| #ddd, #ccc | --text-primary |
| #bbb, #aaa, #999 | --text-secondary |
| #888, #777 | --text-muted |
| #666, #555 | --text-faint |
| #7f6df2 | --accent-color |

### Intentionally preserved
- Error colors (#f88, #5a1d1d) — fixed across themes
- Success green (#4ec9b0, #48c78e) — fixed
- Tag orange (#e6994a) — fixed
- HTML export template — standalone document, no CSS vars
- File type icon colors — fixed semantic colors

## Remaining
- Editor.tsx: 53 hardcoded colors (syntax highlighting theme — needs CM6-specific approach)
- Reader.tsx: 20 hardcoded colors (mostly in markdown renderer CSS)
- Graph.tsx, CanvasView.tsx, LocalGraph.tsx: canvas-based rendering with fixed colors

## Files changed
- `packages/web/src/App.tsx` — bulk color migration
- `packages/web/src/components/Settings.tsx` — CSS variables + shared inputStyle
- 11 other component files — color migration
