import { useState, useEffect, useRef, useCallback } from "react";

interface Candidate {
  path: string;
  name: string;
  type: "file" | "alias" | "heading";
}

interface QuickSwitcherProps {
  onSelect: (path: string) => void;
  onClose: () => void;
  recentPaths?: string[];
}

export function QuickSwitcher({ onSelect, onClose, recentPaths = [] }: QuickSwitcherProps) {
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      // Show recent files when query is empty
      setCandidates(
        recentPaths.map((p) => ({
          path: p,
          name: p.replace(/\.md$/, "").split("/").pop() ?? p,
          type: "file" as const,
        })),
      );
      setSelectedIdx(0);
      return;
    }
    const controller = new AbortController();
    fetch(`/api/vault/switcher?q=${encodeURIComponent(query)}`, {
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((data) => {
        setCandidates(data.candidates ?? []);
        setSelectedIdx(0);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [query, recentPaths]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, candidates.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (candidates[selectedIdx]) {
          onSelect(candidates[selectedIdx].path);
          onClose();
        }
      } else if (e.key === "Escape") {
        onClose();
      }
    },
    [candidates, selectedIdx, onSelect, onClose],
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
          placeholder="Open a note..."
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
          {!query.trim() && candidates.length > 0 && (
            <div style={{ padding: "6px 16px 2px", fontSize: 11, color: "#666", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Recent
            </div>
          )}
          {candidates.map((c, i) => (
            <div
              key={c.path + c.type + c.name}
              style={{
                padding: "8px 16px",
                cursor: "pointer",
                background: i === selectedIdx ? "#37373d" : "transparent",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
              onClick={() => {
                onSelect(c.path);
                onClose();
              }}
              onMouseEnter={() => setSelectedIdx(i)}
            >
              <span style={{ color: "#ddd", fontSize: 14 }}>{c.name}</span>
              {c.type === "alias" && (
                <span style={{ color: "#666", fontSize: 12 }}>
                  alias → {c.path.replace(/\.md$/, "")}
                </span>
              )}
              {c.type === "file" && c.path.includes("/") && (
                <span style={{ color: "#555", fontSize: 12 }}>
                  {c.path.split("/").slice(0, -1).join("/")}
                </span>
              )}
            </div>
          ))}
          {candidates.length === 0 && query && (
            <div style={{ padding: "12px 16px", color: "#666", fontSize: 13 }}>
              No results
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
