# Graceful Missing File Handling

**Date**: 2026-04-05
**Status**: Complete

## What was built

### File not found state for tabs
- When a tab references a non-existent file, shows centered "File not found" message
- Displays the full file path below the message
- Two action buttons: "Create file" (creates empty file + refreshes tree) and "Close tab"
- Added `missing?: boolean` field to Tab interface
- Set on workspace restore when API returns error, and on openTab 404

## Key technical decisions
- **Tab.missing field**: Not persisted in workspace snapshot — re-detected on each restore via fetch
- **Create file action**: Uses existing PUT /api/vault/file endpoint with empty content, then clears missing flag
- **Conditional rendering priority**: Missing check comes before canvas/reader/editor check in the JSX

## Files changed
- `packages/web/src/App.tsx` — Tab interface, workspace restore fetch, openTab fetch, missing file UI
