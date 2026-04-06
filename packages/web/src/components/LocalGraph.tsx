import { useMemo, useRef, useEffect, useState } from "react";

interface LocalGraphProps {
  currentPath: string;
  outgoingLinks: string[];  // resolved paths
  backlinkPaths: string[];  // paths of notes linking to current
  onNavigate: (path: string) => void;
}

interface Node {
  id: string;
  label: string;
  x: number;
  y: number;
  isCurrent: boolean;
}

interface Edge {
  from: string;
  to: string;
}

export function LocalGraph({ currentPath, outgoingLinks, backlinkPaths, onNavigate }: LocalGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [depth, setDepth] = useState(1);
  const [graphEdges, setGraphEdges] = useState<Array<{ source: string; target: string }>>([]);

  // Fetch full graph edges for multi-hop expansion
  useEffect(() => {
    if (depth <= 1) return;
    fetch("/api/vault/graph", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setGraphEdges(data.edges ?? []))
      .catch(() => {});
  }, [depth]);

  const { nodes, edges } = useMemo(() => {
    const currentLabel = currentPath.replace(/\.md$/, "").split("/").pop() || currentPath;
    const nodeMap = new Map<string, Node>();

    // Current node at center
    nodeMap.set(currentPath, {
      id: currentPath,
      label: currentLabel,
      x: 0,
      y: 0,
      isCurrent: true,
    });

    // Collect 1-hop neighbors
    const hop1 = new Set<string>();
    for (const path of outgoingLinks) {
      if (path !== currentPath) hop1.add(path);
    }
    for (const path of backlinkPaths) {
      if (path !== currentPath) hop1.add(path);
    }

    // Collect 2+ hop neighbors from graph edges
    const allNeighbors = new Set(hop1);
    if (depth >= 2 && graphEdges.length > 0) {
      const adj = new Map<string, Set<string>>();
      for (const e of graphEdges) {
        if (!adj.has(e.source)) adj.set(e.source, new Set());
        if (!adj.has(e.target)) adj.set(e.target, new Set());
        adj.get(e.source)!.add(e.target);
        adj.get(e.target)!.add(e.source);
      }
      let frontier = hop1;
      for (let d = 1; d < depth; d++) {
        const next = new Set<string>();
        for (const id of frontier) {
          for (const n of adj.get(id) ?? []) {
            if (!allNeighbors.has(n) && n !== currentPath) {
              allNeighbors.add(n);
              next.add(n);
            }
          }
        }
        frontier = next;
      }
    }

    // Arrange neighbors in a circle
    const neighborArr = [...allNeighbors];
    const radius = Math.min(120, 40 + neighborArr.length * 4);
    neighborArr.forEach((path, i) => {
      const angle = (2 * Math.PI * i) / neighborArr.length - Math.PI / 2;
      const label = path.replace(/\.md$/, "").split("/").pop() || path;
      const isHop1 = hop1.has(path);
      nodeMap.set(path, {
        id: path,
        label,
        x: Math.cos(angle) * (isHop1 ? radius * 0.6 : radius),
        y: Math.sin(angle) * (isHop1 ? radius * 0.6 : radius),
        isCurrent: false,
      });
    });

    const edges: Edge[] = [];
    // 1-hop edges
    for (const path of outgoingLinks) {
      if (nodeMap.has(path) && path !== currentPath) {
        edges.push({ from: currentPath, to: path });
      }
    }
    for (const path of backlinkPaths) {
      if (nodeMap.has(path) && path !== currentPath) {
        const exists = edges.some((e) => e.from === path && e.to === currentPath);
        if (!exists) edges.push({ from: path, to: currentPath });
      }
    }
    // 2+ hop edges from graph data
    if (depth >= 2) {
      const edgeSet = new Set(edges.map((e) => `${e.from}->${e.to}`));
      for (const ge of graphEdges) {
        if (nodeMap.has(ge.source) && nodeMap.has(ge.target)) {
          const key1 = `${ge.source}->${ge.target}`;
          const key2 = `${ge.target}->${ge.source}`;
          if (!edgeSet.has(key1) && !edgeSet.has(key2)) {
            edges.push({ from: ge.source, to: ge.target });
            edgeSet.add(key1);
          }
        }
      }
    }

    return { nodes: [...nodeMap.values()], edges };
  }, [currentPath, outgoingLinks, backlinkPaths, depth, graphEdges]);

  // Simple force simulation for minor adjustments
  const [positions, setPositions] = useState<Map<string, { x: number; y: number }>>(new Map());

  useEffect(() => {
    const pos = new Map<string, { x: number; y: number }>();
    for (const n of nodes) {
      pos.set(n.id, { x: n.x, y: n.y });
    }

    // Run a few iterations of force simulation
    for (let iter = 0; iter < 30; iter++) {
      // Repulsion between all nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = pos.get(nodes[i].id)!;
          const b = pos.get(nodes[j].id)!;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const force = 200 / (dist * dist);
          if (!nodes[i].isCurrent) {
            a.x -= (dx / dist) * force;
            a.y -= (dy / dist) * force;
          }
          if (!nodes[j].isCurrent) {
            b.x += (dx / dist) * force;
            b.y += (dy / dist) * force;
          }
        }
      }

      // Attraction along edges
      for (const edge of edges) {
        const a = pos.get(edge.from)!;
        const b = pos.get(edge.to)!;
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const force = (dist - 60) * 0.01;
        if (!nodes.find((n) => n.id === edge.from)?.isCurrent) {
          a.x += dx * force * 0.5;
          a.y += dy * force * 0.5;
        }
        if (!nodes.find((n) => n.id === edge.to)?.isCurrent) {
          b.x -= dx * force * 0.5;
          b.y -= dy * force * 0.5;
        }
      }
    }

    setPositions(pos);
  }, [nodes, edges]);

  if (nodes.length <= 1) {
    return <div style={{ padding: "8px 12px", fontSize: 12, color: "var(--text-faint)" }}>No connections</div>;
  }

  // Compute viewBox from node positions
  const padding = 40;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [, p] of positions) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  if (!isFinite(minX)) { minX = -100; maxX = 100; minY = -100; maxY = 100; }
  const vbX = minX - padding;
  const vbY = minY - padding;
  const vbW = maxX - minX + padding * 2;
  const vbH = maxY - minY + padding * 2;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", fontSize: 11 }}>
        <span style={{ color: "var(--text-muted)", marginRight: 4 }}>Depth</span>
        {[1, 2, 3].map((d) => (
          <button
            key={d}
            onClick={() => setDepth(d)}
            style={{
              padding: "1px 6px",
              fontSize: 11,
              border: "1px solid var(--border-color)",
              borderRadius: 3,
              background: d === depth ? "var(--accent-color, #7f6df2)" : "transparent",
              color: d === depth ? "#fff" : "var(--text-muted)",
              cursor: "pointer",
            }}
          >
            {d}
          </button>
        ))}
      </div>
    <svg
      ref={svgRef}
      viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
      style={{ width: "100%", height: 180, cursor: "default" }}
    >
      {/* Edges */}
      {edges.map((edge, i) => {
        const from = positions.get(edge.from);
        const to = positions.get(edge.to);
        if (!from || !to) return null;
        const isHighlighted = hoveredNode === edge.from || hoveredNode === edge.to;
        return (
          <line
            key={i}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke={isHighlighted ? "var(--accent-color, #7f6df2)" : "var(--border-color)"}
            strokeWidth={isHighlighted ? 1.5 : 0.8}
            opacity={hoveredNode && !isHighlighted ? 0.2 : 0.6}
          />
        );
      })}
      {/* Nodes */}
      {nodes.map((node) => {
        const pos = positions.get(node.id);
        if (!pos) return null;
        const isHovered = hoveredNode === node.id;
        const dimmed = hoveredNode !== null && !isHovered &&
          !edges.some((e) => (e.from === hoveredNode && e.to === node.id) || (e.to === hoveredNode && e.from === node.id)) &&
          !node.isCurrent;
        return (
          <g
            key={node.id}
            style={{ cursor: "pointer" }}
            onMouseEnter={() => setHoveredNode(node.id)}
            onMouseLeave={() => setHoveredNode(null)}
            onClick={() => { if (!node.isCurrent) onNavigate(node.id); }}
          >
            <circle
              cx={pos.x}
              cy={pos.y}
              r={node.isCurrent ? 6 : 4}
              fill={node.isCurrent ? "var(--accent-color, #7f6df2)" : isHovered ? "#a89bf2" : "var(--text-muted)"}
              opacity={dimmed ? 0.2 : 1}
            />
            {node.isCurrent && (
              <circle
                cx={pos.x}
                cy={pos.y}
                r={10}
                fill="none"
                stroke="var(--accent-color, #7f6df2)"
                strokeWidth={0.5}
                opacity={0.3}
              />
            )}
            <text
              x={pos.x}
              y={pos.y + (node.isCurrent ? 14 : 12)}
              textAnchor="middle"
              fill={dimmed ? "var(--border-color)" : isHovered ? "var(--text-primary)" : "var(--text-muted)"}
              fontSize={node.isCurrent ? 9 : 7}
              fontWeight={node.isCurrent ? 600 : 400}
              fontFamily="-apple-system, sans-serif"
            >
              {node.label.length > 14 ? node.label.slice(0, 12) + "…" : node.label}
            </text>
          </g>
        );
      })}
    </svg>
    </div>
  );
}
