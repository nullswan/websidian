# Daily Notes & Starred Notes

**Date**: 2026-04-05
**Status**: Complete

## What was built

### Daily Notes
- Calendar icon in ribbon (between plugins and settings area)
- Click creates/opens today's note at `Daily Notes/YYYY-MM-DD.md`
- Template: frontmatter (tags: daily, created: date), heading with full date + day name, Tasks + Notes sections
- Idempotent: checks if note exists first (GET), creates only if missing (PUT)
- Also added to command palette as "Open today's daily note"

### Starred Notes
- Star icon in ribbon opens a Starred panel in left sidebar
- Notes starred via tab context menu ("Star" / "Unstar" toggle)
- Starred list persisted in localStorage (`obsidian-web-starred` key)
- Panel shows note names with orange filled star icons
- Click to navigate, right-click to unstar
- Empty state with guidance text

## Key technical decisions
- Daily note uses existing `openTab()` + `/api/vault/file` PUT, no new API needed
- Starred notes stored as `string[]` of paths (same as Obsidian bookmarks)
- `toggleStar` uses functional `setState` to avoid stale closure issues
- Left panel type extended: `"files" | "search" | "plugins" | "starred"`
- Command palette "Open daily note" uses `querySelector` to click the button (avoids duplicating logic)

## Files changed
- `packages/web/src/App.tsx` — daily note button, starred state + panel + ribbon icon + context menu entry
