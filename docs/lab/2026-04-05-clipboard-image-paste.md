# Clipboard Image Paste & Drag-Drop Upload

**Date**: 2026-04-05
**Status**: Complete

## What was built

### Image paste from clipboard
- Pasting image data (Cmd+V / Ctrl+V) in the editor uploads the image to the vault and inserts `![[filename]]`
- Filename generated from original file name or timestamp (`Pasted image 2026-04-05T...`)
- Image preview renders immediately via existing inline image preview StateField

### Drag-and-drop image upload
- Dragging image files into the editor uploads and inserts embed syntax at drop position
- Cursor moves to drop coordinates before inserting
- Multiple images supported (each uploaded separately)

### Upload API endpoint
- `POST /api/vault/upload?filename=<name>` — accepts raw binary body
- Saves to `Attachments/` directory (created if missing)
- Deduplication: `diagram.png` → `diagram 1.png` if original exists
- Content types: `image/png`, `image/jpeg`, `image/gif`, `image/webp`, `image/svg+xml`, `application/octet-stream`
- 10MB body limit

## Key technical decisions
- **Raw binary body** instead of multipart/form-data: avoids `@fastify/multipart` dependency, simpler client code (`file.arrayBuffer()` + fetch)
- **Fastify content type parser**: Added `addContentTypeParser` for image MIME types, parsing as Buffer
- **Shared `uploadAndInsert` helper**: Both paste and drop handlers reuse the same upload + insert logic
- **Server-side deduplication loop**: `readFile` in a while loop to probe existence — simple, no extra deps

## Files changed
- `packages/server/src/index.ts` — body limit, content type parsers for binary
- `packages/server/src/routes/vault.ts` — POST /upload endpoint with deduplication
- `packages/web/src/components/Editor.tsx` — uploadAndInsert, pasteHandler, drop handler
