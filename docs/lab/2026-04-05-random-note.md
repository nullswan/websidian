# Random Note

**Date**: 2026-04-05
**Status**: Complete

## What was built

### Open random note command
- Collects all `.md` file paths from vault tree recursively
- Picks one at random and opens it in a tab
- Toast notification shows the selected note name
- Accessible from command palette ("Open random note")
- Dice icon button in bottom ribbon area

## Key technical decisions
- **No server endpoint needed**: vault tree already in memory, random selection done client-side
- **useCallback with tree dependency**: re-creates only when vault tree changes
- **Dice SVG icon**: 5-dot face (rect + circles) as universal randomness symbol

## Files changed
- `packages/web/src/App.tsx` — openRandomNote callback, command palette entry, ribbon button
