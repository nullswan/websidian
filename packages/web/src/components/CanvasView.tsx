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
      lastMouse.current = { x: e.clientX, y: e.clientY };
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning.current) {
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;
      setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
      lastMouse.current = { x: e.clientX, y: e.clientY };
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  if (error) {
    return <div style={{ padding: 24, color: "#f88" }}>{error}</div>;
  }

  if (!data) {
    return <div style={{ padding: 24, color: "#666" }}>Loading canvas...</div>;
  }

  const nodeMap = new Map(data.nodes.map((n) => [n.id, n]));

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        background: "#1a1a1a",
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
        {data.edges.map((edge) => {
          const fromNode = nodeMap.get(edge.fromNode);
          const toNode = nodeMap.get(edge.toNode);
          if (!fromNode || !toNode) return null;
          const from = getSidePoint(fromNode, edge.fromSide, pan);
          const to = getSidePoint(toNode, edge.toSide, pan);
          return (
            <line
              key={edge.id}
              x1={from.x * zoom + pan.x * (1 - zoom)}
              y1={from.y * zoom + pan.y * (1 - zoom)}
              x2={to.x * zoom + pan.x * (1 - zoom)}
              y2={to.y * zoom + pan.y * (1 - zoom)}
              stroke="rgba(127, 109, 242, 0.5)"
              strokeWidth={2}
            />
          );
        })}
      </svg>

      {data.nodes.map((node) => (
        <div
          key={node.id}
          style={{
            position: "absolute",
            left: pan.x + node.x * zoom,
            top: pan.y + node.y * zoom,
            width: node.width * zoom,
            height: node.height * zoom,
            background: node.color ?? "#2a2a2a",
            border: "1px solid #444",
            borderRadius: 6,
            padding: 8 * zoom,
            color: "#ddd",
            fontSize: 13 * zoom,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            cursor: node.type === "file" ? "pointer" : "default",
          }}
          onClick={() => {
            if (node.type === "file" && node.file) {
              onNavigate(node.file);
            }
          }}
        >
          {node.type === "file" && (
            <div
              style={{
                fontSize: 10 * zoom,
                color: "#7f6df2",
                marginBottom: 4 * zoom,
                fontWeight: 600,
              }}
            >
              {node.file}
            </div>
          )}
          {node.text && (
            <div style={{ lineHeight: 1.4 }}>{node.text}</div>
          )}
          {node.type === "file" && !node.text && (
            <div style={{ color: "#888", fontSize: 11 * zoom }}>
              Click to open
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
