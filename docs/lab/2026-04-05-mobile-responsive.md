# Mobile Responsive Layout

**Date**: 2026-04-05
**Status**: Complete

## What was built

### Responsive layout for narrow screens
- Breakpoint at 768px triggers mobile mode
- Ribbon (icon strip) hidden on mobile
- Left sidebar: overlays as fixed-position drawer with dark backdrop
- Right sidebar: completely hidden on mobile
- Hamburger (☰) button in tab bar toggles sidebar
- Clicking backdrop dismisses sidebar
- Sidebars collapse by default on mobile (initial state check)

## Key technical decisions
- **Inline responsive styles**: Since the app uses inline styles (not CSS modules), mobile detection uses a `useIsMobile` state + resize listener rather than media queries.
- **Overlay drawer**: `position: fixed` sidebar overlays content instead of pushing it, preserving full-width reading/editing on mobile.
- **Right sidebar hidden**: Mobile doesn't have room for the right sidebar (properties, backlinks, outline). Could be added as a bottom sheet later.

## Files changed
- `packages/web/src/App.tsx` — isMobile state, ribbon/sidebar conditional rendering, hamburger button, backdrop overlay
