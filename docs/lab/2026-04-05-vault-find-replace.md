# Vault-Wide Find & Replace

**Date**: 2026-04-05
**Status**: Complete

## What was built

### Replace bar in search panel
- Chevron toggle reveals replace input below search input
- "Replace All" button replaces in all matching files
- Per-file "Replace" button replaces only in that file
- Ctrl+Enter shortcut in replace input for Replace All
- Toast notification: "Replaced N occurrences in M files"
- Results auto-refresh after replacement

### Server endpoint
- `POST /api/vault/search-replace` with body: `{ query, replace, regex?, caseSensitive?, paths? }`
- Optional `paths` array to limit replacement to specific files
- Returns `{ totalReplacements, changedFiles }`

## Key technical decisions
- **Reused search infrastructure**: Replace uses same regex/case-sensitive toggles as search
- **Escaped plain text**: Non-regex queries are escaped and converted to RegExp for uniform `String.replace()` handling
- **Atomic file writes**: Each file is read, transformed, and written back individually
- **No confirmation dialog**: Matches Obsidian behavior — replace is immediate (undo via git)

## Files changed
- `packages/web/src/components/SearchPanel.tsx` — replace bar UI, doReplace function
- `packages/web/src/App.tsx` — wired showToast prop to SearchPanel
- `packages/server/src/routes/vault.ts` — POST /api/vault/search-replace endpoint
