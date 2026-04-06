import { useEffect, useRef, useState, useCallback } from "react";

interface GraphNode {
  id: string;
  name: string;
  wordCount?: number;
  mtime?: number;
  tags?: string[];
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
  const [fullscreen, setFullscreen] = useState(false);
  const [graphFilter, setGraphFilter] = useState("");
  const [showOrphans, setShowOrphans] = useState(true);
  const [filterDepth, setFilterDepth] = useState(1);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; name: string; words: number; links: number } | null>(null);
  const [timelineFilter, setTimelineFilter] = useState(0);
  const [pathStart, setPathStart] = useState<string | null>(null);
  const [pathEnd, setPathEnd] = useState<string | null>(null);
  const [pathNodes, setPathNodes] = useState<Set<string>>(new Set());
  const [pathEdges, setPathEdges] = useState<Set<string>>(new Set()); // "source->target" strings
  const pathNodesRef = useRef<Set<string>>(new Set());
  const pathEdgesRef = useRef<Set<string>>(new Set());
  const pathStartRef = useRef<string | null>(null);
  const pathEndRef = useRef<string | null>(null);
  const [folderLegend, setFolderLegend] = useState<Array<{ folder: string; color: string }>>([]);
  const animRef = useRef<number>(0);
  const panRef = useRef({ x: 0, y: 0 });
  const panTargetRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const zoomTargetRef = useRef(1);
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
    const raw = graphFilter.trim();

    let filteredIds: Set<string>;

    if (raw) {
      // Parse filter prefixes: tag:name, folder:path
      let tagFilter: string | null = null;
      let folderFilter: string | null = null;
      let textFilter = raw;
      textFilter = textFilter.replace(/\btag:(\S+)/gi, (_m, v) => { tagFilter = v.replace(/^#/, "").toLowerCase(); return ""; });
      textFilter = textFilter.replace(/\bfolder:(\S+)/gi, (_m, v) => { folderFilter = v.toLowerCase(); return ""; });
      const q = textFilter.trim().toLowerCase();

      // Start with direct matches
      const matchIds = new Set(all.filter((n) => {
        if (tagFilter && !(n.tags ?? []).some((t) => t.toLowerCase().includes(tagFilter!))) return false;
        if (folderFilter && !n.id.toLowerCase().startsWith(folderFilter!)) return false;
        if (q && !n.name.toLowerCase().includes(q) && !n.id.toLowerCase().includes(q)) return false;
        return tagFilter || folderFilter || q; // at least one filter must match
      }).map(n => n.id));
      // Expand by filterDepth hops
      const expanded = new Set(matchIds);
      let frontier = new Set(matchIds);
      for (let d = 0; d < filterDepth; d++) {
        const next = new Set<string>();
        for (const id of frontier) {
          for (const e of allEdges) {
            if (e.source === id && !expanded.has(e.target)) { expanded.add(e.target); next.add(e.target); }
            if (e.target === id && !expanded.has(e.source)) { expanded.add(e.source); next.add(e.source); }
          }
        }
        frontier = next;
        if (next.size === 0) break;
      }
      filteredIds = expanded;
    } else {
      filteredIds = new Set(all.map(n => n.id));
    }

    let filteredNodes = all.filter(n => filteredIds.has(n.id));

    // Timeline filter: only show notes modified before the cutoff
    if (timelineFilter > 0) {
      const mtimes = all.map((n) => n.mtime ?? 0).filter((t) => t > 0);
      if (mtimes.length > 0) {
        const minT = Math.min(...mtimes);
        const maxT = Math.max(...mtimes);
        const cutoff = minT + ((maxT - minT) * timelineFilter) / 100;
        filteredNodes = filteredNodes.filter((n) => (n.mtime ?? 0) <= cutoff);
      }
    }

    if (!showOrphans) {
      const connected = new Set<string>();
      for (const e of allEdges) { connected.add(e.source); connected.add(e.target); }
      filteredNodes = filteredNodes.filter((n) => connected.has(n.id));
    }

    const nodeIds = new Set(filteredNodes.map((n) => n.id));
    const filteredEdges = allEdges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));

    nodesRef.current = filteredNodes;
    edgesRef.current = filteredEdges;
  }, [loaded, graphFilter, showOrphans, filterDepth, timelineFilter]);

  // BFS shortest path finder
  useEffect(() => {
    if (!pathStart || !pathEnd || pathStart === pathEnd) {
      setPathNodes(new Set());
      setPathEdges(new Set());
      return;
    }
    const edges = allEdgesRef.current;
    const adj = new Map<string, string[]>();
    for (const e of edges) {
      if (!adj.has(e.source)) adj.set(e.source, []);
      if (!adj.has(e.target)) adj.set(e.target, []);
      adj.get(e.source)!.push(e.target);
      adj.get(e.target)!.push(e.source);
    }
    // BFS
    const visited = new Map<string, string | null>();
    visited.set(pathStart, null);
    const queue = [pathStart];
    let found = false;
    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (curr === pathEnd) { found = true; break; }
      for (const neighbor of adj.get(curr) ?? []) {
        if (!visited.has(neighbor)) {
          visited.set(neighbor, curr);
          queue.push(neighbor);
        }
      }
    }
    if (!found) {
      setPathNodes(new Set());
      setPathEdges(new Set());
      return;
    }
    const pNodes = new Set<string>();
    const pEdges = new Set<string>();
    let curr: string | null = pathEnd;
    while (curr) {
      pNodes.add(curr);
      const prev: string | null = visited.get(curr) ?? null;
      if (prev) {
        pEdges.add(`${prev}->${curr}`);
        pEdges.add(`${curr}->${prev}`);
      }
      curr = prev;
    }
    setPathNodes(pNodes);
    setPathEdges(pEdges);
  }, [pathStart, pathEnd]);

  // Keep refs in sync with path state for canvas render loop
  useEffect(() => { pathNodesRef.current = pathNodes; }, [pathNodes]);
  useEffect(() => { pathEdgesRef.current = pathEdges; }, [pathEdges]);
  useEffect(() => { pathStartRef.current = pathStart; }, [pathStart]);
  useEffect(() => { pathEndRef.current = pathEnd; }, [pathEnd]);

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

    // Compute folder colors once
    const folderColorMap = new Map<string, string>();
    const folders = new Set<string>();
    for (const node of nodesRef.current) {
      const parts = node.id.split("/");
      folders.add(parts.length > 1 ? parts.slice(0, -1).join("/") : "(root)");
    }
    const folderList = [...folders].sort();
    const legendEntries: Array<{ folder: string; color: string }> = [];
    for (let i = 0; i < folderList.length; i++) {
      const hue = (i * 360 / Math.max(folderList.length, 1)) % 360;
      const color = `hsl(${hue}, 65%, 65%)`;
      folderColorMap.set(folderList[i], color);
      legendEntries.push({ folder: folderList[i], color });
    }
    setFolderLegend(legendEntries);

    const getNodeColor = (id: string): string => {
      const parts = id.split("/");
      const folder = parts.length > 1 ? parts.slice(0, -1).join("/") : "(root)";
      return folderColorMap.get(folder) ?? "#7f6df2";
    };

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

      // Smooth zoom lerp toward target
      const zDiff = zoomTargetRef.current - zoomRef.current;
      if (Math.abs(zDiff) > 0.001) {
        zoomRef.current += zDiff * 0.15;
      } else {
        zoomRef.current = zoomTargetRef.current;
      }

      // Smooth pan lerp (only when not dragging/panning)
      if (!isPanningRef.current && !dragRef.current.node) {
        const pxDiff = panTargetRef.current.x - panRef.current.x;
        const pyDiff = panTargetRef.current.y - panRef.current.y;
        if (Math.abs(pxDiff) > 0.5 || Math.abs(pyDiff) > 0.5) {
          panRef.current.x += pxDiff * 0.15;
          panRef.current.y += pyDiff * 0.15;
        } else {
          panRef.current.x = panTargetRef.current.x;
          panRef.current.y = panTargetRef.current.y;
        }
      } else {
        panTargetRef.current = { ...panRef.current };
      }

      const cx = canvas.clientWidth / 2 + panRef.current.x;
      const cy = canvas.clientHeight / 2 + panRef.current.y;
      const zoom = zoomRef.current;

      // Draw edges
      const pNodes = pathNodesRef.current;
      const pEdges = pathEdgesRef.current;
      const hasPath = pNodes.size > 0;

      for (const edge of edges) {
        const a = nodeMap.get(edge.source);
        const b = nodeMap.get(edge.target);
        if (!a || !b) continue;

        const isPathEdge = hasPath && (pEdges.has(`${edge.source}->${edge.target}`) || pEdges.has(`${edge.target}->${edge.source}`));
        const isHighlighted = hoverNode && (
          edge.source === hoverNode || edge.target === hoverNode
        );
        const isDimmed = hoverNode && !isHighlighted;

        if (isPathEdge) {
          ctx.strokeStyle = "rgba(255, 200, 50, 0.9)";
          ctx.lineWidth = 3;
        } else {
          ctx.strokeStyle = isHighlighted
            ? "rgba(127, 109, 242, 0.6)"
            : isDimmed
              ? "rgba(127, 109, 242, 0.08)"
              : hasPath
                ? "rgba(127, 109, 242, 0.08)"
                : "rgba(127, 109, 242, 0.2)";
          ctx.lineWidth = isHighlighted ? 1.5 : 1;
        }
        ctx.beginPath();
        ctx.moveTo(cx + a.x * zoom, cy + a.y * zoom);
        ctx.lineTo(cx + b.x * zoom, cy + b.y * zoom);
        ctx.stroke();
      }

      // Collect labels for overlap avoidance
      const labelsToDraw: Array<{ x: number; y: number; label: string; fontSize: number; fillColor: string }> = [];

      // Draw nodes
      for (const node of nodes) {
        const nx = cx + node.x * zoom;
        const ny = cy + node.y * zoom;
        const isActive = node.id === activePath;
        const isHovered = node.id === hoverNode;
        const isNeighbor = hoverNeighbors?.has(node.id) ?? false;
        const isPathNode = hasPath && pNodes.has(node.id);
        const isPathEndpoint = node.id === pathStartRef.current || node.id === pathEndRef.current;
        const isDimmed = hoverNode !== null && !isHovered && !isNeighbor;
        const conns = counts.get(node.id) ?? 0;
        const baseRadius = Math.max(4, Math.min(10, 3 + conns * 1.2));
        const radius = isPathEndpoint ? baseRadius + 3 : isPathNode ? baseRadius + 1.5 : isActive ? baseRadius + 2 : isHovered ? baseRadius + 1 : baseRadius;

        // Glow for active/hovered/path nodes
        if (isActive || isHovered || isPathNode) {
          ctx.beginPath();
          ctx.arc(nx, ny, radius + 6, 0, Math.PI * 2);
          const glow = ctx.createRadialGradient(nx, ny, radius, nx, ny, radius + 6);
          const glowColor = isPathNode ? "rgba(255, 200, 50, 0.35)" : isActive ? "rgba(127, 109, 242, 0.3)" : "rgba(127, 109, 242, 0.2)";
          glow.addColorStop(0, glowColor);
          glow.addColorStop(1, "rgba(0, 0, 0, 0)");
          ctx.fillStyle = glow;
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(nx, ny, radius, 0, Math.PI * 2);
        const nodeColor = getNodeColor(node.id);
        const isOrphan = !counts.get(node.id);
        ctx.fillStyle = isPathEndpoint
          ? "#ffc832"
          : isPathNode
            ? "#ffd866"
            : isActive
              ? "#7f6df2"
              : isHovered
                ? "#9d8ff5"
                : isNeighbor
                  ? "#7f6df2"
                  : isDimmed || (hasPath && !isPathNode)
                    ? "rgba(110, 110, 110, 0.3)"
                    : isOrphan
                      ? "rgba(150, 150, 150, 0.5)"
                      : nodeColor;
        ctx.globalAlpha = isPathEndpoint || isPathNode ? 1 : isActive || isHovered ? 1 : isNeighbor ? 0.8 : isDimmed || (hasPath && !isPathNode) ? 0.4 : isOrphan ? 0.4 : 0.6;
        ctx.fill();
        // Dashed ring for orphan nodes
        if (isOrphan && !isDimmed && !hasPath) {
          ctx.setLineDash([2, 2]);
          ctx.strokeStyle = "rgba(150, 150, 150, 0.4)";
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.globalAlpha = 1;

        // Collect label info for overlap avoidance
        const showLabel = isActive || isHovered || isNeighbor || isPathNode || !hoverNode;
        if (showLabel) {
          const fontSize = isActive || isHovered || isPathNode ? 12 : 10;
          const label = node.name.length > 20 ? node.name.slice(0, 18) + "…" : node.name;
          const fillColor = isPathNode ? "#ffc832" : isActive || isHovered ? textPrimary : isNeighbor ? textSecondary : textMuted;
          labelsToDraw.push({ x: nx, y: ny + radius + 14, label, fontSize, fillColor });
        }
      }

      // Draw labels with simple overlap avoidance
      // Nudge labels that overlap by shifting them vertically
      for (let i = 0; i < labelsToDraw.length; i++) {
        for (let j = i + 1; j < labelsToDraw.length; j++) {
          const a = labelsToDraw[i];
          const b = labelsToDraw[j];
          const dx = Math.abs(a.x - b.x);
          const dy = Math.abs(a.y - b.y);
          const minDx = (a.label.length + b.label.length) * 2.5 * zoom;
          const minDy = Math.max(a.fontSize, b.fontSize) + 2;
          if (dx < minDx && dy < minDy) {
            // Push labels apart vertically
            const overlap = (minDy - dy) / 2 + 1;
            if (a.y < b.y) { a.y -= overlap; b.y += overlap; }
            else { a.y += overlap; b.y -= overlap; }
          }
        }
      }

      for (const lbl of labelsToDraw) {
        ctx.fillStyle = lbl.fillColor;
        ctx.font = `${lbl.fontSize}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(lbl.label, lbl.x, lbl.y);
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
      zoomTargetRef.current = Math.max(0.2, Math.min(5, zoomTargetRef.current * factor));
    };

    const handleMouseDown = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const world = screenToWorld(sx, sy, canvas);
      const node = findNodeAt(world.x, world.y);

      // Alt+Click to set path start/end
      if (e.altKey && node) {
        if (!pathStartRef.current) {
          setPathStart(node.id);
        } else if (!pathEndRef.current) {
          setPathEnd(node.id);
        } else {
          // Reset: start new path
          setPathStart(node.id);
          setPathEnd(null);
        }
        return;
      }

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
        panTargetRef.current = { ...panRef.current };
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

  useEffect(() => {
    if (!fullscreen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setFullscreen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [fullscreen]);

  return (
    <div style={{
      width: fullscreen ? "100vw" : "100%",
      height: fullscreen ? "100vh" : "100%",
      position: fullscreen ? "fixed" : "relative",
      inset: fullscreen ? 0 : undefined,
      zIndex: fullscreen ? 10000 : undefined,
      background: "var(--bg-primary)",
      display: "flex",
      flexDirection: "column",
    }}>
      <div style={{ padding: "6px 8px", display: "flex", gap: 6, alignItems: "center", borderBottom: "1px solid var(--border-color)", flexShrink: 0 }}>
        <input
          type="text"
          value={graphFilter}
          onChange={(e) => setGraphFilter(e.target.value)}
          placeholder="Filter... (tag: folder:)"
          style={{ flex: 1, padding: "3px 6px", border: "1px solid var(--border-color)", borderRadius: 3, background: "var(--bg-tertiary)", color: "var(--text-primary)", fontSize: 11, outline: "none" }}
        />
        {graphFilter && (
          <label style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }} title={`Show ${filterDepth} hop(s) from matches`}>
            <input type="range" min={0} max={3} value={filterDepth} onChange={(e) => setFilterDepth(parseInt(e.target.value))} style={{ width: 40, accentColor: "var(--accent-color)" }} />
            {filterDepth}
          </label>
        )}
        <label style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: "var(--text-muted)", cursor: "pointer", whiteSpace: "nowrap" }}>
          <input type="checkbox" checked={showOrphans} onChange={(e) => setShowOrphans(e.target.checked)} style={{ accentColor: "var(--accent-color)" }} />
          Orphans
        </label>
        <button
          onClick={() => setFullscreen((v) => !v)}
          title={fullscreen ? "Exit full screen" : "Full screen"}
          style={{ background: "none", border: "none", color: "var(--text-faint)", cursor: "pointer", padding: "2px", fontSize: 14, lineHeight: 1, flexShrink: 0 }}
        >
          {fullscreen ? "⤓" : "⤢"}
        </button>
        <span style={{ fontSize: 10, color: "var(--text-faint)" }}>{nodesRef.current.length} notes · {edgesRef.current.length} links</span>
      </div>
      {/* Timeline slider */}
      <div style={{ padding: "2px 8px 4px", borderBottom: "1px solid var(--border-color)", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <span style={{ fontSize: 10, color: "var(--text-faint)", flexShrink: 0 }}>Timeline</span>
        <input
          type="range"
          min={0}
          max={100}
          value={timelineFilter}
          onChange={(e) => setTimelineFilter(parseInt(e.target.value))}
          style={{ flex: 1, accentColor: "var(--accent-color)", height: 12 }}
        />
        <span style={{ fontSize: 10, color: timelineFilter > 0 ? "var(--accent-color)" : "var(--text-faint)", minWidth: 24, textAlign: "right" }}>
          {timelineFilter === 0 ? "All" : `${timelineFilter}%`}
        </span>
      </div>
      {/* Path finder UI */}
      {(pathStart || pathEnd || pathNodes.size > 0) && (
        <div style={{ padding: "4px 8px", borderBottom: "1px solid var(--border-color)", display: "flex", alignItems: "center", gap: 6, flexShrink: 0, fontSize: 11 }}>
          <span style={{ color: "#ffc832", fontWeight: 600, flexShrink: 0 }}>Path:</span>
          {pathNodes.size > 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 2, overflow: "hidden" }}>
              {(() => {
                // Reconstruct ordered path from pathStart to pathEnd
                const ordered: string[] = [];
                if (pathStart) {
                  let curr: string | null = pathEnd;
                  const visited = new Map<string, string | null>();
                  // Quick BFS re-trace using pathEdges
                  const adj = new Map<string, string[]>();
                  for (const key of pathEdges) {
                    const [a, b] = key.split("->");
                    if (!adj.has(a)) adj.set(a, []);
                    adj.get(a)!.push(b);
                  }
                  // BFS from start
                  const bfsVisited = new Map<string, string | null>();
                  bfsVisited.set(pathStart, null);
                  const queue = [pathStart];
                  while (queue.length > 0) {
                    curr = queue.shift()!;
                    if (curr === pathEnd) break;
                    for (const n of adj.get(curr) ?? []) {
                      if (!bfsVisited.has(n) && pathNodes.has(n)) {
                        bfsVisited.set(n, curr);
                        queue.push(n);
                      }
                    }
                  }
                  // Reconstruct
                  curr = pathEnd;
                  while (curr) {
                    ordered.unshift(curr);
                    curr = bfsVisited.get(curr) ?? null;
                  }
                }
                return ordered.map((id, i) => {
                  const name = id.replace(/\.md$/, "").split("/").pop() ?? id;
                  return (
                    <span key={id} style={{ display: "flex", alignItems: "center", gap: 2 }}>
                      {i > 0 && <span style={{ color: "var(--text-faint)" }}>&rarr;</span>}
                      <span
                        onClick={() => onNavigate(id)}
                        style={{
                          color: i === 0 || i === ordered.length - 1 ? "#ffc832" : "#ffd866",
                          cursor: "pointer",
                          fontWeight: i === 0 || i === ordered.length - 1 ? 600 : 400,
                          whiteSpace: "nowrap",
                        }}
                        title={id}
                      >
                        {name}
                      </span>
                    </span>
                  );
                });
              })()}
              <span style={{ color: "var(--text-faint)", marginLeft: 4 }}>({pathNodes.size} hops)</span>
            </div>
          ) : pathStart && !pathEnd ? (
            <span style={{ color: "var(--text-muted)" }}>
              Alt+Click second node (from: {pathStart.replace(/\.md$/, "").split("/").pop()})
            </span>
          ) : pathStart && pathEnd ? (
            <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>No path found</span>
          ) : null}
          <button
            onClick={() => { setPathStart(null); setPathEnd(null); }}
            style={{ marginLeft: "auto", background: "none", border: "1px solid var(--border-color)", borderRadius: 3, color: "var(--text-muted)", cursor: "pointer", padding: "1px 6px", fontSize: 10, flexShrink: 0 }}
          >
            Clear
          </button>
        </div>
      )}
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
          display: "flex",
          gap: 4,
          alignItems: "center",
        }}
      >
        <span style={{ color: "var(--text-faint)", fontSize: 10, marginRight: 4 }}>
          Scroll zoom · Drag · Dbl-click open · Alt+Click path
        </span>
        <button
          onClick={() => { zoomTargetRef.current = Math.min(3, zoomTargetRef.current * 1.3); }}
          style={{ width: 24, height: 24, border: "1px solid var(--border-color)", borderRadius: 4, background: "var(--bg-tertiary)", color: "var(--text-secondary)", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
          title="Zoom in"
        >+</button>
        <button
          onClick={() => { zoomTargetRef.current = Math.max(0.2, zoomTargetRef.current / 1.3); }}
          style={{ width: 24, height: 24, border: "1px solid var(--border-color)", borderRadius: 4, background: "var(--bg-tertiary)", color: "var(--text-secondary)", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
          title="Zoom out"
        >−</button>
        <button
          onClick={() => {
            zoomTargetRef.current = 1;
            panTargetRef.current = { x: 0, y: 0 };
          }}
          style={{ width: 24, height: 24, border: "1px solid var(--border-color)", borderRadius: 4, background: "var(--bg-tertiary)", color: "var(--text-secondary)", cursor: "pointer", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
          title="Reset view"
        >⟲</button>
        {activePath && (
          <button
            onClick={() => {
              const node = nodesRef.current.find((n) => n.id === activePath);
              if (node) {
                panTargetRef.current = { x: -node.x * zoomRef.current, y: -node.y * zoomRef.current };
                zoomTargetRef.current = Math.max(zoomTargetRef.current, 1.5);
              }
            }}
            style={{ width: 24, height: 24, border: "1px solid var(--border-color)", borderRadius: 4, background: "var(--bg-tertiary)", color: "var(--accent-color)", cursor: "pointer", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
            title="Center on active note"
          >◎</button>
        )}
      </div>
      {folderLegend.length > 1 && (
        <div style={{
          position: "absolute",
          bottom: 8,
          left: 8,
          background: "var(--bg-secondary)",
          border: "1px solid var(--border-color)",
          borderRadius: 6,
          padding: "4px 8px",
          fontSize: 10,
          maxHeight: 120,
          overflowY: "auto",
          opacity: 0.85,
        }}>
          {folderLegend.map((f) => (
            <div key={f.folder} style={{ display: "flex", alignItems: "center", gap: 4, padding: "1px 0" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: f.color, flexShrink: 0 }} />
              <span style={{ color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 100 }}>
                {f.folder}
              </span>
            </div>
          ))}
        </div>
      )}
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
            animation: "graph-tooltip-in 0.15s ease-out",
            backdropFilter: "blur(8px)",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 2, color: "var(--accent-color)" }}>{tooltip.name}</div>
          <div style={{ color: "var(--text-muted)", fontSize: 11 }}>
            {tooltip.words.toLocaleString()} words · {tooltip.links} link{tooltip.links !== 1 ? "s" : ""}
          </div>
        </div>
      )}
    </div>
  );
}
