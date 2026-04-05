# Rich Empty State

**Date**: 2026-04-05
**Status**: Complete

## What was built
- When no tabs are open, the content area shows a rich empty state instead of plain text
- Displays the vault name in large, light font
- Three quick action buttons: New Note (Ctrl+N), Quick Switcher (Ctrl+O), Daily Note (Ctrl+D)
- Buttons show keyboard shortcuts below the label and highlight border purple on hover
- "Ctrl+/ for all shortcuts" hint at the bottom

## Implementation
- Replaced the plain "Select a file to edit" div with a flex column layout
- Action buttons use inline event handlers for hover state
- Buttons directly call existing `createNewNote`, `setShowSwitcher`, and `openDailyNote` callbacks

## Files changed
- `packages/web/src/App.tsx` — replaced empty state JSX in renderPaneContent
