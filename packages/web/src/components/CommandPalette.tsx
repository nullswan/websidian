import { useState, useEffect, useRef, useMemo, useCallback } from "react";

interface Command {
  id: string;
  name: string;
  shortcut?: string;
  action: () => void;
}

interface CommandPaletteProps {
  commands: Command[];
  onClose: () => void;
}

export function CommandPalette({ commands, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = useMemo(() => {
    if (!query) return commands;
    const q = query.toLowerCase();
    return commands.filter((c) => c.name.toLowerCase().includes(q));
  }, [query, commands]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [filtered.length]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filtered[selectedIdx]) {
          filtered[selectedIdx].action();
          onClose();
        }
      } else if (e.key === "Escape") {
        onClose();
      }
    },
    [filtered, selectedIdx, onClose],
  );

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        justifyContent: "center",
        paddingTop: "15vh",
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: 500,
          maxHeight: "60vh",
          background: "#2a2a2a",
          borderRadius: 8,
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a command..."
          style={{
            padding: "12px 16px",
            border: "none",
            borderBottom: "1px solid #444",
            background: "transparent",
            color: "#ddd",
            fontSize: 15,
            outline: "none",
          }}
        />
        <div style={{ overflow: "auto", flex: 1 }}>
          {filtered.map((cmd, i) => (
            <div
              key={cmd.id}
              style={{
                padding: "8px 16px",
                cursor: "pointer",
                background: i === selectedIdx ? "#37373d" : "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
              onClick={() => {
                cmd.action();
                onClose();
              }}
              onMouseEnter={() => setSelectedIdx(i)}
            >
              <span style={{ color: "#ddd", fontSize: 14 }}>{cmd.name}</span>
              {cmd.shortcut && (
                <span
                  style={{
                    color: "#666",
                    fontSize: 11,
                    background: "#1e1e1e",
                    padding: "2px 6px",
                    borderRadius: 3,
                  }}
                >
                  {cmd.shortcut}
                </span>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: "12px 16px", color: "#666", fontSize: 13 }}>
              No matching commands
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
