import { useState, useEffect, useRef, useCallback } from "react";

interface Candidate {
  path: string;
  name: string;
  type: "file" | "alias" | "heading";
  matches?: number[];
}

interface QuickSwitcherProps {
  onSelect: (path: string) => void;
  onClose: () => void;
  recentPaths?: string[];
  onCreateNote?: (title: string) => void;
}

function HighlightedName({ name, matches }: { name: string; matches?: number[] }) {
  if (!matches || matches.length === 0) return <>{name}</>;
  const matchSet = new Set(matches);
  return (
    <>
      {name.split("").map((ch, i) =>
        matchSet.has(i) ? (
          <span key={i} style={{ color: "var(--accent-color)", fontWeight: 600 }}>{ch}</span>
        ) : (
          <span key={i}>{ch}</span>
        ),
      )}
    </>
  );
}

export function QuickSwitcher({ onSelect, onClose, recentPaths = [], onCreateNote }: QuickSwitcherProps) {
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
        } else if (query.trim() && onCreateNote) {
          onCreateNote(query.trim());
          onClose();
        }
      } else if (e.key === "Escape") {
        onClose();
      }
    },
    [candidates, selectedIdx, onSelect, onClose, query, onCreateNote],
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
        animation: "palette-backdrop-in 0.15s ease-out",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: 500,
          maxHeight: "60vh",
          background: "var(--bg-tertiary)",
          borderRadius: 8,
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          animation: "palette-panel-in 0.2s cubic-bezier(0.22, 1, 0.36, 1)",
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
            borderBottom: "1px solid var(--border-color)",
            background: "transparent",
            color: "var(--text-primary)",
            fontSize: 15,
            outline: "none",
          }}
        />
        <div style={{ overflow: "auto", flex: 1 }}>
          {!query.trim() && candidates.length > 0 && (
            <div style={{ padding: "6px 16px 2px", fontSize: 11, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Recent
            </div>
          )}
          {candidates.map((c, i) => (
            <div
              key={c.path + c.type + c.name}
              ref={i === selectedIdx ? (el) => el?.scrollIntoView({ block: "nearest" }) : undefined}
              style={{
                padding: "8px 16px",
                cursor: "pointer",
                background: i === selectedIdx ? "var(--bg-hover)" : "transparent",
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
              <span style={{ color: "var(--text-primary)", fontSize: 14 }}>
                <HighlightedName name={c.name} matches={c.matches} />
              </span>
              {c.type === "alias" && (
                <span style={{ color: "var(--text-faint)", fontSize: 12 }}>
                  alias → {c.path.replace(/\.md$/, "")}
                </span>
              )}
              {c.type === "file" && c.path.includes("/") && (
                <span style={{ color: "var(--text-faint)", fontSize: 12, marginLeft: "auto", flexShrink: 0 }}>
                  {c.path.replace(/\.md$/, "").split("/").slice(0, -1).join("/")}
                </span>
              )}
            </div>
          ))}
          {candidates.length === 0 && query && (
            <div
              style={{
                padding: "10px 16px",
                cursor: onCreateNote ? "pointer" : "default",
                background: "var(--bg-hover)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
              onClick={() => {
                if (onCreateNote && query.trim()) {
                  onCreateNote(query.trim());
                  onClose();
                }
              }}
            >
              {onCreateNote ? (
                <>
                  <span style={{ color: "var(--text-faint)", fontSize: 13 }}>Create note:</span>
                  <span style={{ color: "var(--accent-color)", fontSize: 14, fontWeight: 500 }}>
                    {query.trim()}
                  </span>
                  <span style={{ color: "var(--text-faint)", fontSize: 11, marginLeft: "auto" }}>
                    Enter
                  </span>
                </>
              ) : (
                <span style={{ color: "var(--text-faint)", fontSize: 13 }}>No results</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
