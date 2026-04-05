# Interactive Checkboxes

**Date**: 2026-04-04
**Status**: Complete

## What was built
- Checkboxes in reading view are now clickable (not disabled)
- Clicking a checkbox toggles the corresponding `- [ ]` / `- [x]` in the markdown source
- Changes are saved to the server automatically via PUT /api/vault/file
- Positional index matching: nth checkbox in rendered HTML maps to nth task line in source

## Implementation
- Reader component gets `onSave` prop from App
- After setting innerHTML, checkboxes are enabled and get `data-idx` attributes
- Click handler walks source lines to find the nth `- [ ]` / `- [x]` pattern and toggles it
- `contentRef` (useRef) tracks latest content to avoid stale closure issues

## Files changed
- `packages/web/src/components/Reader.tsx` — added onSave prop, checkbox enablement, toggle handler
- `packages/web/src/App.tsx` — passed handleSave to Reader
