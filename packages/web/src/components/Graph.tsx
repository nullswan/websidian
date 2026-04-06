import { useEffect, useRef, useState, useCallback } from "react";

interface GraphNode {
  id: string;
  name: string;
  wordCount?: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface GraphEdge {
  source: string;
  target: string;
}

interface GraphProps {
  onNavigate: (path: string) => void;
  activePath?: string | null;
}

export function Graph({ onNavigate, activePath }: GraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);
  const allNodesRef = useRef<GraphNode[]>([]);
  const allEdgesRef = useRef<GraphEdge[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [graphFilter, setGraphFilter] = useState("");
  const [showOrphans, setShowOrphans] = useState(true);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; name: string; words: number; links: number } | null>(null);
  const animRef = useRef<number>(0);
  const panRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const dragRef = useRef<{ node: GraphNode | null; offsetX: number; offsetY: number }>({
    node: null,
    offsetX: 0,
    offsetY: 0,
  });
  const isPanningRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });

  // Fetch graph data
  useEffect(() => {
    fetch("/api/vault/graph")
      .then((r) => r.json())
      .then((data) => {
        const nodes: GraphNode[] = (data.nodes ?? []).map(
          (n: { id: string; name: string; wordCount?: number }, i: number) => {
            const angle = (i / data.nodes.length) * Math.PI * 2;
            const radius = 150 + Math.random() * 100;
            return {
              ...n,
              x: Math.cos(angle) * radius,
              y: Math.sin(angle) * radius,
              vx: 0,
              vy: 0,
            };
          },
        );
        allNodesRef.current = nodes;
        allEdgesRef.current = data.edges ?? [];
        nodesRef.current = nodes;
        edgesRef.current = data.edges ?? [];
        setLoaded(true);
      });
  }, []);

  // Apply filters when graphFilter or showOrphans changes
  useEffect(() => {
    if (!loaded) return;
    const all = allNodesRef.current;
    const allEdges = allEdgesRef.current;
    const q = graphFilter.toLowerCase();

    let filteredNodes = q ? all.filter((n) => n.name.toLowerCase().includes(q) || n.id.toLowerCase().includes(q)) : [...all];

    if (!showOrphans) {
      const connected = new Set<string>();
      for (const e of allEdges) { connected.add(e.source); connected.add(e.target); }
      filteredNodes = filteredNodes.filter((n) => connected.has(n.id));
    }

    const nodeIds = new Set(filteredNodes.map((n) => n.id));
    const filteredEdges = allEdges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));

    nodesRef.current = filteredNodes;
    edgesRef.current = filteredEdges;
  }, [loaded, graphFilter, showOrphans]);

  // Screen to world coordinates
  const screenToWorld = useCallback((sx: number, sy: number, canvas: HTMLCanvasElement) => {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    return {
      x: (sx - cx - panRef.current.x) / zoomRef.current,
      y: (sy - cy - panRef.current.y) / zoomRef.current,
    };
  }, []);

  // Find node at position
  const findNodeAt = useCallback((wx: number, wy: number) => {
    for (const node of nodesRef.current) {
      const dx = wx - node.x;
      const dy = wy - node.y;
      if (dx * dx + dy * dy < 12 * 12) return node;
    }
    return null;
  }, []);

  const hoverNodeRef = useRef<string | null>(null);

  // Precompute connection counts for node sizing
  const connectionCountRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!loaded) return;
    const counts = new Map<string, number>();
    for (const edge of edgesRef.current) {
      counts.set(edge.source, (counts.get(edge.source) ?? 0) + 1);
      counts.set(edge.target, (counts.get(edge.target) ?? 0) + 1);
    }
    connectionCountRef.current = counts;
  }, [loaded]);

  // Build neighbor sets for highlight-on-hover
  const neighborsRef = useRef<Map<string, Set<string>>>(new Map());
  useEffect(() => {
    if (!loaded) return;
    const map = new Map<string, Set<string>>();
    for (const edge of edgesRef.current) {
      if (!map.has(edge.source)) map.set(edge.source, new Set());
      if (!map.has(edge.target)) map.set(edge.target, new Set());
      map.get(edge.source)!.add(edge.target);
      map.get(edge.target)!.add(edge.source);
    }
    neighborsRef.current = map;
  }, [loaded]);

  // Force simulation + render loop
  useEffect(() => {
    if (!loaded) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let cooling = 1;

    const tick = () => {
      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      const nodeMap = new Map(nodes.map((n) => [n.id, n]));
      const counts = connectionCountRef.current;
      const hoverNode = hoverNodeRef.current;
      const hoverNeighbors = hoverNode ? neighborsRef.current.get(hoverNode) : null;

      if (cooling > 0.01) {
        // Repulsion between all nodes
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const a = nodes[i];
            const b = nodes[j];
            let dx = b.x - a.x;
            let dy = b.y - a.y;
            const dist = Math.sqrt(dx * dx + dy * dy) + 1;
            const force = (800 / (dist * dist)) * cooling;
            dx = (dx / dist) * force;
            dy = (dy / dist) * force;
            if (a !== dragRef.current.node) { a.vx -= dx; a.vy -= dy; }
            if (b !== dragRef.current.node) { b.vx += dx; b.vy += dy; }
          }
        }

        // Attraction along edges
        for (const edge of edges) {
          const a = nodeMap.get(edge.source);
          const b = nodeMap.get(edge.target);
          if (!a || !b) continue;
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy) + 1;
          const force = (dist - 80) * 0.02 * cooling;
          dx = (dx / dist) * force;
          dy = (dy / dist) * force;
          if (a !== dragRef.current.node) { a.vx += dx; a.vy += dy; }
          if (b !== dragRef.current.node) { b.vx -= dx; b.vy -= dy; }
        }

        // Center gravity
        for (const node of nodes) {
          if (node === dragRef.current.node) continue;
          node.vx -= node.x * 0.005 * cooling;
          node.vy -= node.y * 0.005 * cooling;
        }

        // Apply velocity with damping
        for (const node of nodes) {
          if (node === dragRef.current.node) continue;
          node.x += node.vx;
          node.y += node.vy;
          node.vx *= 0.85;
          node.vy *= 0.85;
        }

        cooling *= 0.995;
      }

      // Render
      const styles = getComputedStyle(document.documentElement);
      const textPrimary = styles.getPropertyValue("--text-primary").trim() || "#ddd";
      const textSecondary = styles.getPropertyValue("--text-secondary").trim() || "#bbb";
      const textMuted = styles.getPropertyValue("--text-muted").trim() || "#888";
      const bgPrimary = styles.getPropertyValue("--bg-primary").trim() || "#1a1a1a";

      canvas.width = canvas.clientWidth * devicePixelRatio;
      canvas.height = canvas.clientHeight * devicePixelRatio;
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      ctx.fillStyle = bgPrimary;
      ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);

      const cx = canvas.clientWidth / 2 + panRef.current.x;
      const cy = canvas.clientHeight / 2 + panRef.current.y;
      const zoom = zoomRef.current;

      // Draw edges
      for (const edge of edges) {
        const a = nodeMap.get(edge.source);
        const b = nodeMap.get(edge.target);
        if (!a || !b) continue;

        const isHighlighted = hoverNode && (
          edge.source === hoverNode || edge.target === hoverNode
        );
        const isDimmed = hoverNode && !isHighlighted;

        ctx.strokeStyle = isHighlighted
          ? "rgba(127, 109, 242, 0.6)"
          : isDimmed
            ? "rgba(127, 109, 242, 0.08)"
            : "rgba(127, 109, 242, 0.2)";
        ctx.lineWidth = isHighlighted ? 1.5 : 1;
        ctx.beginPath();
        ctx.moveTo(cx + a.x * zoom, cy + a.y * zoom);
        ctx.lineTo(cx + b.x * zoom, cy + b.y * zoom);
        ctx.stroke();
      }

      // Draw nodes
      for (const node of nodes) {
        const nx = cx + node.x * zoom;
        const ny = cy + node.y * zoom;
        const isActive = node.id === activePath;
        const isHovered = node.id === hoverNode;
        const isNeighbor = hoverNeighbors?.has(node.id) ?? false;
        const isDimmed = hoverNode !== null && !isHovered && !isNeighbor;
        const conns = counts.get(node.id) ?? 0;
        const baseRadius = Math.max(4, Math.min(10, 3 + conns * 1.2));
        const radius = isActive ? baseRadius + 2 : isHovered ? baseRadius + 1 : baseRadius;

        // Glow for active/hovered nodes
        if (isActive || isHovered) {
          ctx.beginPath();
          ctx.arc(nx, ny, radius + 6, 0, Math.PI * 2);
          const glow = ctx.createRadialGradient(nx, ny, radius, nx, ny, radius + 6);
          glow.addColorStop(0, isActive ? "rgba(127, 109, 242, 0.3)" : "rgba(127, 109, 242, 0.2)");
          glow.addColorStop(1, "rgba(127, 109, 242, 0)");
          ctx.fillStyle = glow;
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(nx, ny, radius, 0, Math.PI * 2);
        ctx.fillStyle = isActive
          ? "#7f6df2"
          : isHovered
            ? "#9d8ff5"
            : isNeighbor
              ? "#7f6df2"
              : isDimmed
                ? "rgba(110, 110, 110, 0.3)"
                : "#7f6df2";
        ctx.globalAlpha = isActive || isHovered ? 1 : isNeighbor ? 0.8 : isDimmed ? 0.4 : 0.6;
        ctx.fill();
        ctx.globalAlpha = 1;

        // Label
        const showLabel = isActive || isHovered || isNeighbor || !hoverNode;
        if (showLabel) {
          ctx.fillStyle = isActive || isHovered ? textPrimary : isNeighbor ? textSecondary : textMuted;
          ctx.font = `${isActive || isHovered ? 12 : 10}px system-ui, sans-serif`;
          ctx.textAlign = "center";
          ctx.fillText(node.name, nx, ny + radius + 14);
        }
      }

      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [loaded, activePath]);

  // Mouse handlers
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      zoomRef.current = Math.max(0.2, Math.min(5, zoomRef.current * factor));
    };

    const handleMouseDown = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const world = screenToWorld(sx, sy, canvas);
      const node = findNodeAt(world.x, world.y);

      if (node) {
        dragRef.current = { node, offsetX: world.x - node.x, offsetY: world.y - node.y };
      } else {
        isPanningRef.current = true;
        lastMouseRef.current = { x: e.clientX, y: e.clientY };
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (dragRef.current.node) {
        const rect = canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const world = screenToWorld(sx, sy, canvas);
        dragRef.current.node.x = world.x - dragRef.current.offsetX;
        dragRef.current.node.y = world.y - dragRef.current.offsetY;
        dragRef.current.node.vx = 0;
        dragRef.current.node.vy = 0;
      } else if (isPanningRef.current) {
        const dx = e.clientX - lastMouseRef.current.x;
        const dy = e.clientY - lastMouseRef.current.y;
        panRef.current.x += dx;
        panRef.current.y += dy;
        lastMouseRef.current = { x: e.clientX, y: e.clientY };
      } else {
        // Hover detection
        const rect = canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const world = screenToWorld(sx, sy, canvas);
        const node = findNodeAt(world.x, world.y);
        const newHover = node?.id ?? null;
        if (newHover !== hoverNodeRef.current) {
          hoverNodeRef.current = newHover;
          canvas.style.cursor = newHover ? "pointer" : "default";
          if (node) {
            const linkCount = edgesRef.current.filter(
              (e) => e.source === node.id || e.target === node.id,
            ).length;
            setTooltip({
              x: e.clientX,
              y: e.clientY,
              name: node.name,
              words: node.wordCount ?? 0,
              links: linkCount,
            });
          } else {
            setTooltip(null);
          }
        } else if (node && tooltip) {
          // Update position as mouse moves over same node
          setTooltip((prev) => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
        }
      }
    };

    const handleMouseUp = () => {
      dragRef.current = { node: null, offsetX: 0, offsetY: 0 };
      isPanningRef.current = false;
    };

    const handleDblClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const world = screenToWorld(sx, sy, canvas);
      const node = findNodeAt(world.x, world.y);
      if (node) onNavigate(node.id);
    };

    const handleMouseLeave = () => {
      hoverNodeRef.current = null;
      canvas.style.cursor = "default";
      setTooltip(null);
    };

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    canvas.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    canvas.addEventListener("dblclick", handleDblClick);
    canvas.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      canvas.removeEventListener("wheel", handleWheel);
      canvas.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      canvas.removeEventListener("dblclick", handleDblClick);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [loaded, onNavigate, screenToWorld, findNodeAt]);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", background: "var(--bg-primary)", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "6px 8px", display: "flex", gap: 6, alignItems: "center", borderBottom: "1px solid var(--border-color)", flexShrink: 0 }}>
        <input
          type="text"
          value={graphFilter}
          onChange={(e) => setGraphFilter(e.target.value)}
          placeholder="Filter..."
          style={{ flex: 1, padding: "3px 6px", border: "1px solid var(--border-color)", borderRadius: 3, background: "var(--bg-tertiary)", color: "var(--text-primary)", fontSize: 11, outline: "none" }}
        />
        <label style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: "var(--text-muted)", cursor: "pointer", whiteSpace: "nowrap" }}>
          <input type="checkbox" checked={showOrphans} onChange={(e) => setShowOrphans(e.target.checked)} style={{ accentColor: "var(--accent-color)" }} />
          Orphans
        </label>
        <span style={{ fontSize: 10, color: "var(--text-faint)" }}>{nodesRef.current.length} notes · {edgesRef.current.length} links</span>
      </div>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", flex: 1, display: "block" }}
      />
      {!loaded && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-faint)",
          }}
        >
          Loading graph...
        </div>
      )}
      <div
        style={{
          position: "absolute",
          bottom: 8,
          right: 8,
          color: "var(--text-faint)",
          fontSize: 11,
        }}
      >
        Scroll to zoom · Drag nodes · Double-click to open
      </div>
      {tooltip && (
        <div
          style={{
            position: "fixed",
            left: tooltip.x + 12,
            top: tooltip.y - 10,
            background: "var(--bg-tertiary)",
            border: "1px solid var(--border-color)",
            borderRadius: 6,
            padding: "6px 10px",
            fontSize: 12,
            color: "var(--text-primary)",
            pointerEvents: "none",
            zIndex: 1000,
            boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
            whiteSpace: "nowrap",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 2 }}>{tooltip.name}</div>
          <div style={{ color: "var(--text-muted)", fontSize: 11 }}>
            {tooltip.words.toLocaleString()} words · {tooltip.links} link{tooltip.links !== 1 ? "s" : ""}
          </div>
        </div>
      )}
    </div>
  );
}
