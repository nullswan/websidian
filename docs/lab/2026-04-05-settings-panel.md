# Settings Panel

**Date**: 2026-04-05
**Status**: Complete

## What was built
- Full Settings modal accessible via gear icon in ribbon
- Three sections: Appearance, Editor, About
- Appearance settings: show inline title, readable line length
- Editor settings: font size (10-32px), show line numbers, spell check, tab size (2/4/8)
- About section: project info, keyboard shortcuts reference
- All settings persisted in localStorage via `obsidian-web-settings` key
- Settings applied live — changes take effect immediately without reload

## Key technical decisions
- Settings stored as a flat object in localStorage, merged with defaults on load
- Toggle component: CSS-only animation with `transition` on left position and background color
- Readable line length: CSS class `wide-mode` removes `max-width: 750px` from `.reader-view` and `.inline-title`
- Editor font size: dynamic `EditorView.theme()` extension overrides the static theme
- Spell check: `EditorView.contentAttributes.of({ spellcheck })` — was previously hardcoded to true
- Modal overlay with Escape key dismiss and click-outside-to-close

## Files changed
- `packages/web/src/components/Settings.tsx` — new component (Settings, SettingItem, Toggle)
- `packages/web/src/App.tsx` — settings state, gear button wiring, inline title conditional, wide-mode class
- `packages/web/src/components/Editor.tsx` — fontSize and spellCheck props
- `packages/web/src/styles.css` — `.wide-mode` override rules
