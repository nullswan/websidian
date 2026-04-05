# Collapsible Sidebar Sections

**Date**: 2026-04-05
**Status**: Complete

## What was built
- All 5 right sidebar sections (Properties, Backlinks, Outline, Tags, CSS Snippets) are now independently collapsible
- Click the section header to toggle expand/collapse
- Small chevron (▶/▼) animates with CSS transition on toggle
- Collapsed state persists per-section in localStorage

## Implementation
- Created `SidebarSection` component with `useState` lazy initializer reading from `localStorage`
- Each section wrapped with `<SidebarSection title="...">` in App.tsx right sidebar
- Removed duplicate internal headers and `borderTop` from Properties, Backlinks, Outline, Tags, and Snippets components
- localStorage keys: `sidebar-Properties`, `sidebar-Backlinks (N)`, etc.

## Files changed
- `packages/web/src/App.tsx` — added SidebarSection component, wrapped sidebar children
- `packages/web/src/components/Properties.tsx` — removed internal header
- `packages/web/src/components/Backlinks.tsx` — removed internal header and borderTop
- `packages/web/src/components/Outline.tsx` — removed internal header and borderTop
- `packages/web/src/components/Tags.tsx` — removed internal header and borderTop
- `packages/web/src/components/Snippets.tsx` — removed internal header, padding, and borderTop
