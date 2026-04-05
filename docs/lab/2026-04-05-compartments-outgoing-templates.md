# CM6 Compartments, Outgoing Links & Templates

**Date**: 2026-04-05
**Status**: Complete

## What was built

### CM6 Compartments for hot-swappable settings
- Replaced editor useEffect recreation with Compartment-based hot-swap
- fontSize, spellCheck, showLineNumbers, tabSize all update instantly
- Preserves cursor position, undo history, and scroll state
- Editor only recreates when filePath changes

### Outgoing Links panel
- Parses wikilinks from current note content
- Displays between Backlinks and Outline in right sidebar
- Shows link count in section header
- Clickable — uses handleNavigate for proper vault-wide resolution
- Deduplicates by full target path

### Note Templates
- Templates folder configurable in Settings (default: "Templates")
- "Insert template" command in command palette
- Template picker modal with search, keyboard navigation (arrows + Enter)
- Supports {{date}}, {{time}}, {{title}} template variables
- Variables resolved at insert time, not creation time
- Two sample templates: Meeting Notes and Project

## Key technical decisions
- **Compartments**: `useRef(new Compartment())` persists across renders; second useEffect dispatches `reconfigure` effects
- **Template walking**: reuses /api/vault/tree response, client-side filters to templates folder
- **Template insertion**: appends to existing content (doesn't replace), saves immediately via handleSave

## Files changed
- `packages/web/src/components/Editor.tsx` — Compartment imports, refs, hot-swap useEffect
- `packages/web/src/App.tsx` — OutgoingLinks component, TemplatePicker component, template state + command
- `packages/web/src/components/Settings.tsx` — templatesFolder setting in AppSettings
- `fixtures/test-vault/Templates/` — Meeting Notes.md, Project.md
