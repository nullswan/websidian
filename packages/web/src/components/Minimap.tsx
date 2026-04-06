import { useRef, useEffect, useMemo, useCallback } from "react";

interface MinimapProps {
  content: string;
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  onSeek: (fraction: number) => void;
  searchQuery?: string;
}

export function Minimap({ content, scrollTop, scrollHeight, clientHeight, onSeek, searchQuery }: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const height = 200;
  const width = 60;

  // Compute line-level data
  const lines = useMemo(() => {
    return content.split("\n").map((line) => {
      const trimmed = line.trimStart();
      const isHeading = /^#{1,6}\s/.test(trimmed);
      const isList = /^[-*+]\s|^\d+\.\s/.test(trimmed);
      const isCode = /^```/.test(trimmed) || /^\t/.test(line) || /^ {4}/.test(line);
      const isEmpty = trimmed.length === 0;
      const len = Math.min(trimmed.length, 80);
      return { len, isHeading, isList, isCode, isEmpty };
    });
  }, [content]);

  // Draw minimap
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const totalLines = lines.length || 1;
    const lineH = Math.max(1, height / totalLines);

    // Draw lines
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.isEmpty) continue;
      const y = (i / totalLines) * height;
      const w = (line.len / 80) * (width - 8);

      if (line.isHeading) {
        ctx.fillStyle = "rgba(127, 109, 242, 0.6)";
        ctx.fillRect(2, y, Math.max(w, 10), Math.max(lineH, 1.5));
      } else if (line.isCode) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
        ctx.fillRect(6, y, w, Math.max(lineH, 1));
      } else if (line.isList) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
        ctx.fillRect(4, y, w, Math.max(lineH, 1));
      } else {
        ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
        ctx.fillRect(2, y, w, Math.max(lineH, 1));
      }
    }

    // Draw search match markers
    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const contentLines = content.split("\n");
      ctx.fillStyle = "rgba(255, 180, 50, 0.7)";
      for (let i = 0; i < contentLines.length; i++) {
        if (contentLines[i].toLowerCase().includes(q)) {
          const y = (i / totalLines) * height;
          ctx.fillRect(width - 4, y, 4, Math.max(lineH, 2));
        }
      }
    }

    // Draw viewport indicator
    if (scrollHeight > clientHeight) {
      const viewStart = (scrollTop / scrollHeight) * height;
      const viewH = Math.max((clientHeight / scrollHeight) * height, 10);
      ctx.fillStyle = "rgba(127, 109, 242, 0.15)";
      ctx.fillRect(0, viewStart, width, viewH);
      ctx.strokeStyle = "rgba(127, 109, 242, 0.4)";
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, viewStart + 0.5, width - 1, viewH - 1);
    }
  }, [lines, scrollTop, scrollHeight, clientHeight, content, searchQuery]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = e.clientY - rect.top;
    const fraction = y / height;
    onSeek(Math.max(0, Math.min(1, fraction)));
  }, [onSeek]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onClick={handleClick}
      style={{
        width,
        height,
        cursor: "pointer",
        borderLeft: "1px solid var(--border-color)",
        background: "var(--bg-secondary)",
        flexShrink: 0,
      }}
      title="Click to jump"
    />
  );
}
