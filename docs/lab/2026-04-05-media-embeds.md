# Audio, Video, and PDF Embeds

**Date**: 2026-04-05
**Status**: Complete

## What was built

### Media embed rendering in reader view
- `![[song.mp3]]` → HTML5 `<audio>` player with controls (max-width 500px)
- `![[clip.mp4]]` → HTML5 `<video>` player with controls (max-width 640px)
- `![[doc.pdf]]` → `<iframe>` viewer (600px height)

### Supported formats
- Audio: mp3, wav, ogg, m4a, flac, aac, wma
- Video: mp4, webm, mov, mkv, avi, ogv
- PDF: pdf

### Resolution
- Hydration useEffect resolves `data-target` via `/api/vault/resolve`
- Sets `<source>` src for audio/video, `<iframe>` src for PDF
- Falls back to raw target path if resolution fails

## Files changed
- `packages/web/src/lib/markdown.ts` — detect media extensions in embed renderer
- `packages/web/src/components/Reader.tsx` — new hydration useEffect for media/PDF
