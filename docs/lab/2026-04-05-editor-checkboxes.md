# Clickable Checkboxes in Editor Live Preview

**Date**: 2026-04-05
**Status**: Complete

## What was built

### Interactive checkboxes in editor
- `- [ ]` renders as unchecked checkbox input
- `- [x]` renders as checked checkbox input (purple accent)
- Clicking toggles between checked/unchecked
- Dispatches CM6 transaction to update document text
- Raw `[ ]`/`[x]` syntax revealed when cursor is on the line

## Key technical decisions
- **Decoration.replace**: replaces `[ ]` or `[x]` inline range with checkbox input widget
- **ignoreEvent returns false**: allows click events to reach the widget (unlike image widget which blocks events)
- **mousedown handler**: uses `view.posAtDOM()` to find the widget's document position, then matches the line regex to find the bracket position
- **Active line exclusion**: checkboxes on cursor line show raw syntax (consistent with heading/wikilink behavior)

## Files changed
- `packages/web/src/components/Editor.tsx` — CheckboxWidget class, buildCheckboxDecorations, checkboxField StateField
