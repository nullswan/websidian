import { useCallback, useRef } from "react";

interface ResizeHandleProps {
  side: "left" | "right";
  onResize: (delta: number) => void;
}

export function ResizeHandle({ side, onResize }: ResizeHandleProps) {
  const startX = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      startX.current = e.clientX;

      const handleMouseMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startX.current;
        startX.current = ev.clientX;
        // For left sidebar: dragging right = positive delta = wider
        // For right sidebar: dragging left = negative delta = wider
        onResize(side === "left" ? delta : -delta);
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [onResize, side],
  );

  return (
    <div
      className="resize-handle"
      style={{
        [side === "left" ? "right" : "left"]: -3,
      }}
      onMouseDown={handleMouseDown}
    />
  );
}
