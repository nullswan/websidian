# Image Serving

**Date**: 2026-04-04
**Status**: Complete

## What was built

### Raw file endpoint
- `GET /api/vault/raw?path=...` — serves binary files with correct MIME type
- Supports: png, jpg, jpeg, gif, svg, webp, bmp, pdf, mp3, mp4, wav
- Path traversal prevention (rejects `..`)

### Image rendering
- Image embeds (`![[image.png]]`) now render actual images in reading view
- Markdown renderer points `<img>` src to `/api/vault/raw?path=...` instead of `/api/vault/file?path=...`
- CSS: max-width 100%, border-radius 4px

### Test fixture
- Replaced placeholder `diagram.png` text file with a real 100x60 PNG (purple rectangle on dark bg)

## Files changed
- `packages/server/src/routes/vault.ts` — added `/raw` endpoint
- `packages/web/src/lib/markdown.ts` — changed image src to use `/raw`
- `packages/web/src/styles.css` — added `.embed-image` styles
- `fixtures/test-vault/Attachments/diagram.png` — replaced with real PNG
- `docs/api.md` — documented raw endpoint
