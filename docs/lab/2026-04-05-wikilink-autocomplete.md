# Wikilink Autocomplete in Editor

**Date**: 2026-04-05
**Status**: Complete

## What was built
- Typing `[[` in the editor triggers an autocomplete dropdown
- Fuzzy-matches vault file names using the existing `/api/vault/switcher` API
- Shows file name and parent folder path in the dropdown
- Selecting a completion inserts the note path (without .md) and closes with `]]`
- Arrow keys + Enter to select, Escape to dismiss

## Implementation
- Uses `@codemirror/autocomplete` extension — CM6's first-class completion system
- Custom `wikilinkCompletion` async function checks if cursor is inside `[[...`
- Fetches candidates from `/api/vault/switcher?q=<query>`
- Custom `apply` function handles the insertion + closing brackets
- `activateOnTyping: true` triggers the popup as the user types

## Files changed
- `packages/web/src/components/Editor.tsx` — added autocomplete import, wikilinkCompletion function, autocompletion extension
- `packages/web/package.json` — added `@codemirror/autocomplete` dependency
