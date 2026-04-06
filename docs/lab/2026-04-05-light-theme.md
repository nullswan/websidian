# Light Theme Support

**Date**: 2026-04-05
**Status**: Complete (Phase 1)

## What was built

### Light/dark theme toggle
- Theme selector in Settings > Appearance (dropdown: Dark / Light)
- `data-theme` attribute on `<html>` element for CSS targeting
- CSS custom properties for all theme colors
- Reader view fully themed (headings, code, blockquotes, tables, embeds, hover previews)
- Persisted in localStorage via AppSettings

## CSS Variables defined
- `--bg-primary`, `--bg-secondary`, `--bg-tertiary` — background layers
- `--text-primary`, `--text-secondary`, `--text-muted`, `--text-faint` — text hierarchy
- `--border-color`, `--border-subtle` — borders
- `--heading-color`, `--reader-text`, `--code-bg`, `--shadow` — specialized

## Phase 2 (future)
- Migrate inline styles in App.tsx to CSS variables
- Theme the CM6 editor based on light/dark setting
- Theme sidebar, tab bar, status bar

## Files changed
- `packages/web/src/styles.css` — CSS variables for dark/light, reader view themed
- `packages/web/src/components/Settings.tsx` — theme field in AppSettings, theme selector UI
- `packages/web/src/App.tsx` — data-theme attribute effect
