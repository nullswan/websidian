# Regex and Case-Sensitive Search

**Date**: 2026-04-05
**Status**: Complete

## What was built

### Regex toggle (.*) in search panel
- Click `.*` to toggle regex mode — placeholder changes to "Regex pattern..."
- Server validates regex with try/catch, returns 400 for invalid patterns
- Client shows error inline with red border on invalid regex
- Regex highlighting uses `split(RegExp)` with capturing group to wrap matches

### Case-sensitive toggle (Aa)
- Click `Aa` to toggle case-sensitive matching
- Works for both plain text and regex modes
- Active state shown with purple background + border

### Both toggles trigger re-search immediately via debounce effect

## Key technical decisions
- **Server-side regex execution**: `new RegExp(query, flags)` with `"g"` flag for `.test()` per line. `lastIndex` reset before each test since `"g"` flag is stateful.
- **Client highlight with split**: `text.split(new RegExp(\`(\${query})\`, flags))` produces alternating non-match/match array — clean way to highlight without manual index tracking
- **Toggle button styling**: Shared `toggleBtnStyle(active)` factory for consistent active/inactive appearance

## Files changed
- `packages/server/src/routes/vault.ts` — `regex` and `caseSensitive` query params, regex validation
- `packages/web/src/components/SearchPanel.tsx` — toggle states, param passing, regex-aware highlighting
