# Inline Image Preview in Editor

**Date**: 2026-04-05
**Status**: Complete

## What was built

### Live Preview image rendering
- `![[image.png]]` embeds render the image below the source line in editor
- `![alt](url)` standard markdown images also render inline
- Image hides when cursor is on the embed line (edit the syntax, preview disappears)
- Only image extensions are matched: png, jpg, gif, svg, webp, bmp, ico, avif
- Non-image embeds like `![[Concepts#Tags]]` are correctly ignored
- External URLs (`https://...`) used directly; vault images use `/api/vault/raw`

## Key technical decisions
- **StateField** (not ViewPlugin): needs to rebuild decorations on selection change to hide preview when cursor is on the image line
- **Decoration.widget with block: true, side: 1**: renders image *after* the line end, as a block-level element below the text
- **Regex anchored to full line** (`^![[...]]$`): only previews images that are standalone on a line (not inline mentions)
- **img.onerror**: hides the wrapper entirely if image fails to load (broken paths)
- **img.loading = "lazy"**: defers loading for off-screen images

## Files changed
- `packages/web/src/components/Editor.tsx` — ImagePreviewWidget class, resolveImageSrc helper, buildImageDecorations function, imagePreviewField StateField
