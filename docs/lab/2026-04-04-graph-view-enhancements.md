# Graph View Enhancements

**Date**: 2026-04-04
**Status**: Complete

## What was built
- Node sizing based on connection count (hub nodes appear larger)
- Purple-themed nodes instead of gray, matching the app's accent color
- Radial gradient glow effect on active and hovered nodes
- Hover detection: hovered node + neighbors highlighted, others dimmed
- Edge highlighting: connected edges brighten on hover, others fade
- Labels hidden for dimmed nodes to reduce visual noise
- Pointer cursor on hoverable nodes

## Implementation
- Precomputed `connectionCountRef` map on data load for O(1) sizing lookups
- Precomputed `neighborsRef` adjacency map for hover highlight logic
- `hoverNodeRef` updated via mousemove handler (no state → no re-renders)
- `createRadialGradient` for node glow effects
- `globalAlpha` modulation for dimming unrelated nodes

## Files changed
- `packages/web/src/components/Graph.tsx` — hover detection, connection-based sizing, glow effects, neighbor highlighting
