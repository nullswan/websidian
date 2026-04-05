# Settings & Theming

**Date**: 2026-04-05
**Status**: Complete

## What was built

### Customizable accent color
- Color picker in Settings > Appearance > Accent color
- Applied via CSS custom property `--accent-color`
- 10 CSS selectors updated: links, blockquotes, checkboxes, properties, search focus, etc.
- Reset button to restore default Obsidian purple
- Persisted in localStorage

### Focus mode
- Dims inactive editor lines to 30% opacity
- Active line stays at full brightness with smooth transition
- Toggle in Settings > Editor > Focus mode
- Pure CSS via CM6 `EditorView.theme()` Compartment

### Typewriter mode
- Keeps cursor line vertically centered while typing
- Uses CM6 `requestMeasure` for layout-safe scroll adjustment
- 10px dead zone prevents jittery centering
- Toggle in Settings > Editor > Typewriter mode

## Key technical decisions
- **CSS custom properties**: `var(--accent-color, #7f6df2)` with fallback for runtime theming. JS sets property on `documentElement`.
- **7 Compartments**: CM6 editor now has 7 independently hot-swappable settings: fontSize, spellCheck, lineNumbers, tabSize, indentUnit, typewriter, focusMode.

## Files changed
- `packages/web/src/styles.css` — CSS variable, 10 accent color references
- `packages/web/src/components/Settings.tsx` — accentColor, focusMode, typewriterMode
- `packages/web/src/components/Editor.tsx` — typewriter, focus mode Compartments
- `packages/web/src/App.tsx` — CSS variable setter, prop wiring
