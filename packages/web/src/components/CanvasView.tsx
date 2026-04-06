import { useState, useEffect, useRef, useCallback } from "react";

interface CanvasNode {
  id: string;
  type: "text" | "file" | "link" | "group";
  text?: string;
  file?: string;
  url?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
}

interface CanvasEdge {
  id: string;
  fromNode: string;
  toNode: string;
  fromSide?: string;
  toSide?: string;
  label?: string;
}

interface CanvasData {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

interface CanvasViewProps {
  content: string;
  onNavigate: (path: string) => void;
}

function getSidePoint(node: CanvasNode, side: string | undefined, offset: { x: number; y: number }) {
  const cx = offset.x + node.x + node.width / 2;
  const cy = offset.y + node.y + node.height / 2;
  switch (side) {
    case "top": return { x: cx, y: offset.y + node.y };
    case "bottom": return { x: cx, y: offset.y + node.y + node.height };
    case "left": return { x: offset.x + node.x, y: cy };
    case "right": return { x: offset.x + node.x + node.width, y: cy };
    default: return { x: cx, y: cy };
  }
}

export function CanvasView({ content, onNavigate }: CanvasViewProps) {
  const [data, setData] = useState<CanvasData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const isPanning = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const dragNodeId = useRef<string | null>(null);
  const didDrag = useRef(false);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  useEffect(() => {
    if (!content) {
      setData(null);
      setError(null);
      return;
    }
    try {
      const parsed = JSON.parse(content);
      setData(parsed);
      setError(null);
    } catch {
      setError("Invalid canvas JSON");
    }
  }, [content]);

  // Center the canvas on mount
  useEffect(() => {
    if (!data || !containerRef.current) return;
    const container = containerRef.current;
    const minX = Math.min(...data.nodes.map((n) => n.x));
    const minY = Math.min(...data.nodes.map((n) => n.y));
    const maxX = Math.max(...data.nodes.map((n) => n.x + n.width));
    const maxY = Math.max(...data.nodes.map((n) => n.y + n.height));
    const contentW = maxX - minX;
    const contentH = maxY - minY;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const fitZoom = Math.min(
      (container.clientWidth - 80) / contentW,
      (container.clientHeight - 80) / contentH,
      1.5,
    );
    setZoom(Math.max(0.3, fitZoom));
    setPan({
      x: container.clientWidth / 2 - centerX * fitZoom,
      y: container.clientHeight / 2 - centerY * fitZoom,
    });
  }, [data]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.max(0.2, Math.min(3, z * factor)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      isPanning.current = true;
      setSelectedNode(null);
      lastMouse.current = { x: e.clientX, y: e.clientY };
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragNodeId.current && data) {
      didDrag.current = true;
      const dx = (e.clientX - lastMouse.current.x) / zoom;
      const dy = (e.clientY - lastMouse.current.y) / zoom;
      lastMouse.current = { x: e.clientX, y: e.clientY };
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          nodes: prev.nodes.map((n) =>
            n.id === dragNodeId.current ? { ...n, x: n.x + dx, y: n.y + dy } : n
          ),
        };
      });
    } else if (isPanning.current) {
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;
      setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
      lastMouse.current = { x: e.clientX, y: e.clientY };
    }
  }, [zoom, data]);

  const handleMouseUp = useCallback(() => {
    dragNodeId.current = null;
    isPanning.current = false;
  }, []);

  if (error) {
    return <div style={{ padding: 24, color: "#f88" }}>{error}</div>;
  }

  if (!data) {
    return <div style={{ padding: 24, color: "var(--text-faint)" }}>Loading canvas...</div>;
  }

  const nodeMap = new Map(data.nodes.map((n) => [n.id, n]));

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        background: `var(--bg-primary)`,
        backgroundImage: `radial-gradient(circle, rgba(127,127,127,0.15) 1px, transparent 1px)`,
        backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
        backgroundPosition: `${pan.x % (20 * zoom)}px ${pan.y % (20 * zoom)}px`,
        position: "relative",
        cursor: isPanning.current ? "grabbing" : "grab",
      }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <svg
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      >
        <defs>
          <marker id="canvas-arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <path d="M0,0 L8,3 L0,6" fill="none" stroke="rgba(127, 109, 242, 0.6)" strokeWidth="1.5" />
          </marker>
        </defs>
        {data.edges.map((edge) => {
          const fromNode = nodeMap.get(edge.fromNode);
          const toNode = nodeMap.get(edge.toNode);
          if (!fromNode || !toNode) return null;
          const from = getSidePoint(fromNode, edge.fromSide, pan);
          const to = getSidePoint(toNode, edge.toSide, pan);
          const x1 = from.x * zoom + pan.x * (1 - zoom);
          const y1 = from.y * zoom + pan.y * (1 - zoom);
          const x2 = to.x * zoom + pan.x * (1 - zoom);
          const y2 = to.y * zoom + pan.y * (1 - zoom);
          return (
            <g key={edge.id}>
              <line
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="rgba(127, 109, 242, 0.5)"
                strokeWidth={2}
                markerEnd="url(#canvas-arrow)"
              />
              {edge.label && (
                <text
                  x={(x1 + x2) / 2}
                  y={(y1 + y2) / 2 - 6}
                  fill="var(--text-faint)"
                  fontSize={11 * zoom}
                  textAnchor="middle"
                >
                  {edge.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {data.nodes.map((node) => {
        const isGroup = node.type === "group";
        return (
          <div
            key={node.id}
            className="canvas-node"
            style={{
              position: "absolute",
              left: pan.x + node.x * zoom,
              top: pan.y + node.y * zoom,
              width: node.width * zoom,
              height: node.height * zoom,
              background: isGroup
                ? (node.color ? node.color + "20" : "rgba(127,109,242,0.06)")
                : (node.color ?? "var(--bg-secondary)"),
              border: selectedNode === node.id
                ? "2px solid var(--accent-color)"
                : isGroup
                  ? `2px dashed ${node.color || "rgba(127,109,242,0.3)"}`
                  : "1px solid var(--border-color)",
              borderRadius: isGroup ? 8 : 6,
              padding: 8 * zoom,
              color: "var(--text-primary)",
              fontSize: 13 * zoom,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              cursor: dragNodeId.current === node.id ? "grabbing" : "grab",
              transition: dragNodeId.current === node.id ? "none" : "box-shadow 0.15s",
              boxShadow: selectedNode === node.id ? "0 0 0 1px var(--accent-color), 0 4px 16px rgba(0,0,0,0.3)" : "0 2px 8px rgba(0,0,0,0.2)",
              zIndex: selectedNode === node.id ? 10 : isGroup ? 0 : 1,
            }}
            onMouseDown={(e) => {
              if (e.button === 0) {
                e.stopPropagation();
                dragNodeId.current = node.id;
                didDrag.current = false;
                setSelectedNode(node.id);
                lastMouse.current = { x: e.clientX, y: e.clientY };
              }
            }}
            onClick={() => {
              if (didDrag.current) return;
              if (node.type === "file" && node.file) {
                onNavigate(node.file);
              } else if (node.type === "link" && node.url) {
                window.open(node.url, "_blank", "noopener,noreferrer");
              }
            }}
          >
            {node.type === "file" && (
              <div
                style={{
                  fontSize: 10 * zoom,
                  color: "var(--accent-color)",
                  marginBottom: 4 * zoom,
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {node.file}
              </div>
            )}
            {node.type === "link" && (
              <div
                style={{
                  fontSize: 10 * zoom,
                  color: "var(--accent-color)",
                  marginBottom: 4 * zoom,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {node.url}
              </div>
            )}
            {node.text && (
              <div style={{ lineHeight: 1.4, overflow: "hidden" }}>{node.text}</div>
            )}
            {node.type === "file" && !node.text && (
              <div style={{ color: "var(--text-muted)", fontSize: 11 * zoom }}>
                Click to open
              </div>
            )}
            {isGroup && node.text && (
              <div style={{
                position: "absolute",
                top: -14 * zoom,
                left: 8 * zoom,
                fontSize: 11 * zoom,
                color: node.color || "var(--accent-color)",
                fontWeight: 600,
                background: "var(--bg-primary)",
                padding: "0 4px",
              }}>
                {node.text}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
