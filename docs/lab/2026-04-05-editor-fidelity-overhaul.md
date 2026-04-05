# Editor Visual Fidelity Overhaul

**Date**: 2026-04-05
**Status**: Complete

## What was built
- Switched editor font from monospace to system sans-serif (matching Obsidian)
- Frontmatter rendered as Properties widget (StateField with replace decoration)
- Editable inline title above note content (contentEditable div)
- Heading markers hidden in Live Preview, revealed on active line
- Tags colored orange (#e6994a) matching Obsidian
- Wikilinks styled as plain purple text (no background pill)
- Purple selection highlight, subtle H1 bottom border
- Proper line-height (1.65) and content max-width (750px)

## Key technical decisions
- Frontmatter widget uses `StateField` not `ViewPlugin` because replace decorations spanning line breaks require StateField
- Heading marker hiding uses CSS targeting `.cm-heading-line > span:first-child` since CM6 uses obfuscated class names (not `tok-*`) with `HighlightStyle`
- Initial cursor positioned after frontmatter so the Properties widget displays immediately

## Files changed
- `packages/web/src/components/Editor.tsx` — frontmatter StateField, initial cursor position, highlight style updates
- `packages/web/src/styles.css` — inline title, frontmatter widget, heading marker hiding, reader view font/spacing
