# Typewriter Scrolling Mode

**Date**: 2026-04-05
**Status**: Complete

## What was built

### Typewriter scroll in editor
- Active line stays centered vertically as you type
- Smooth scrolling via `scrollBy({ behavior: "smooth" })`
- Toggle in Settings > Editor > Typewriter mode
- 10px dead zone prevents jittery micro-scrolling

## Key technical decisions
- **CM6 requestMeasure**: Uses `read/write` phase split to avoid layout thrashing. Read phase gets cursor coordinates, write phase performs scroll.
- **Compartment hot-swap**: TypewriterMode toggles between an `EditorView.updateListener` and `[]` (empty extension) via Compartment reconfigure.
- **Doc change + selection change**: Triggers on both `docChanged` and `selectionSet` to handle typing and cursor movement.

## Files changed
- `packages/web/src/components/Editor.tsx` — typewriterMode prop, Compartment, requestMeasure listener
- `packages/web/src/components/Settings.tsx` — typewriterMode in AppSettings interface + toggle UI
- `packages/web/src/App.tsx` — wired typewriterMode prop
