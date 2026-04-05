# Image Embed Resolution (Shortest-Path)

**Date**: 2026-04-04
**Status**: Complete

## What was built
- `![[diagram.png]]` now resolves via vault-wide search, matching Obsidian behavior
- Images no longer require full paths — short filenames work
- Resolution uses the same `/api/vault/resolve` endpoint as note embeds

## Problem
Previously, `![[diagram.png]]` would try to load `/api/vault/raw?path=diagram.png` directly, which failed because the actual file was at `Attachments/diagram.png`.

## Implementation

### Resolver changes (`packages/vault-core/src/resolver.ts`)
- Extended `buildResolverIndex` to index all files, not just `.md` files
- Added exact-path matching for files with extensions (before `.md` fallback)
- Added extension-aware basename filtering — `diagram.png` matches basename `diagram` but filters to `.png` candidates only

### Render pipeline (`packages/web/`)
- Image embeds now render with `data-target` attribute and no `src` (placeholder)
- `Reader.tsx` hydration effect resolves each image target via `/api/vault/resolve`
- On success, sets `img.src` to `/api/vault/raw?path=<resolved>`
- On failure, falls back to raw target path

## Files changed
- `packages/vault-core/src/resolver.ts` — index all files, extension-aware resolution
- `packages/web/src/lib/markdown.ts` — image embed outputs `data-target` placeholder
- `packages/web/src/components/Reader.tsx` — image hydration effect
- `fixtures/test-vault/Concepts.md` — added Images section with short-name embed
