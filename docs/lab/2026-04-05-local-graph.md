# Local Graph View

**Date**: 2026-04-05
**Status**: Complete

## What was built

### Mini graph in right sidebar
- Shows current note at center with direct connections (outgoing links + backlinks)
- SVG-based, 180px tall, responsive width
- Force-directed layout: 30 iterations of repulsion + attraction
- Current node: purple filled circle with radial glow ring
- Hover: highlights node + connected edges, dims unrelated nodes
- Click neighbor node to navigate to that note
- Labels truncated to 14 chars with ellipsis
- "No connections" placeholder for isolated notes
- Collapsible via SidebarSection

## Key technical decisions
- **Circular initial placement**: Neighbors start evenly spaced on a circle around center. Radius scales with neighbor count.
- **Pinned center**: Current node stays at (0,0) during force simulation — only neighbors move.
- **30-iteration force sim**: Fast, deterministic, no animation needed. Runs once in `useEffect`.
- **Dynamic viewBox**: Computed from actual node positions with 40px padding, ensuring all nodes visible.
- **Deduplicated edges**: Bidirectional links (A→B and B→A) only show one edge.

## Files changed
- `packages/web/src/components/LocalGraph.tsx` — new component (250 lines)
- `packages/web/src/App.tsx` — import, SidebarSection with outgoing links + backlink paths
