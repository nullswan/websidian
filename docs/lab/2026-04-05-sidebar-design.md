# Sidebar Design Overhaul

**Date**: 2026-04-05
**Status**: Complete

## What was built
- Obsidian-style vertical icon ribbon (44px) on the far left edge
- Four ribbon icons: File Explorer, Search, Graph View, Plugins
- Settings gear at ribbon bottom (opens command palette)
- New Note / New Folder icon buttons in file explorer header
- Sidebar panel background changed to #252526
- File tree items: rounded hover states with subtle transitions
- Tab close buttons hidden by default, visible on hover
- Right sidebar section headers with hover feedback

## Key technical decisions
- Ribbon is a separate flex column (44px fixed) outside the sidebar panel
- Graph icon toggles graph view directly (not a sidebar panel)
- File tree hover uses `rgba(255,255,255,0.04)` for subtle highlight
- Tab close uses CSS `.tab:hover .tab-close` for Obsidian-like behavior
- SidebarSection chevron replaced with SVG path for crisp rendering

## Files changed
- `packages/web/src/App.tsx` — icon ribbon, sidebar header, SidebarSection styling
- `packages/web/src/components/FileTree.tsx` — hover states, spacing, filter input focus
- `packages/web/src/styles.css` — tab bar, tab close, active tab styling
