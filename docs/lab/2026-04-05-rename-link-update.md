# Auto-Update Wikilinks on File Rename

**Date**: 2026-04-05
**Status**: Complete

## What was built
- Server-side link auto-update when a file is renamed via `POST /api/vault/rename`
- Scans all `.md` files in the vault for wikilinks pointing to the old filename
- Updates link targets to the new filename while preserving:
  - Fragment references (`#heading`)
  - Display text (`|alias`)
  - Full-path references (`Folder/Name`)
  - Embed syntax (`![[...]]`)
- Frontend: renamed tab's path updated, affected tabs re-fetch content
- Optional `updateLinks: false` body param to skip link updates

## Key technical decisions
- Regex-based replacement: single-pass `\[\[(path|basename)(#fragment)?(\|display)?\]\]`
- Embed `![[...]]` handled automatically — `!` is outside the match boundary
- Both basename (`[[Concepts]]`) and full-path (`[[Folder/Concepts]]`) references updated
- Server returns `updatedFiles` array so frontend knows which open tabs need refresh
- Uses `setTabsMap` functional updater to avoid stale closure when re-fetching affected content

## Files changed
- `packages/server/src/routes/vault.ts` — enhanced rename endpoint with link scanning
- `packages/web/src/App.tsx` — `handleFileRenamed` callback, passed to FileTree
- `packages/web/src/components/FileTree.tsx` — `onFileRenamed` prop, called after rename API

## Test
- Renamed `Concepts.md` → `Ideas.md` via API
- Verified 4 files updated: Welcome.md, Daily Notes/2026-04-04.md, Projects/Project Alpha.md, Projects/Project Beta.md
- All link variants correctly updated: `[[Concepts]]`, `[[Concepts#Backlinks]]`, `[[Concepts|My Concepts]]`, `![[Concepts#Tags]]`
- Renamed back to restore fixtures — clean roundtrip confirmed
