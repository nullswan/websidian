# Save Status Indicator

**Date**: 2026-04-05
**Status**: Complete

## What was built

### Auto-save status in status bar
- "Saving..." (orange) appears when auto-save writes to server
- "Saved" with checkmark (teal) appears on success, fades after 2s
- No indicator in idle state to keep status bar clean
- Resets to idle on error (error shown separately)

## Key technical decisions
- **State machine**: idle → saving → saved → idle with 2s timeout
- **Timer ref cleanup**: `clearTimeout` on rapid saves prevents stale transitions
- **Minimal UI**: indicator shares space with cursor position, no layout shift

## Files changed
- `packages/web/src/App.tsx` — saveStatus state, timer ref, handleSave updates
- `packages/web/src/components/StatusBar.tsx` — saveStatus prop, conditional render
