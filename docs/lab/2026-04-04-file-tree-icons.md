# File Tree Icons

**Date**: 2026-04-04
**Status**: Complete

## What was built
- SVG chevron icons replacing plain text "v" and ">" for folder expand/collapse
- Folder icons with open/closed variants
- File type icons color-coded by extension:
  - Purple (#7f6df2) for `.md` files
  - Teal (#4ec9b0) for images (png, jpg, gif, svg, webp)
  - Orange (#e6994a) for `.canvas` files
  - Gray (#888) for other file types
- Flex layout for proper icon/text alignment

## Implementation
- Inline SVG React components: ChevronRight, ChevronDown, FolderIcon, FileIcon
- No icon library dependency — keeps bundle small
- `flexShrink: 0` prevents icon collapse in narrow sidebars

## Files changed
- `packages/web/src/components/FileTree.tsx` — added icon components, updated folder/file node rendering
