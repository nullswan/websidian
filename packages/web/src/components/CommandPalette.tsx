import { useState, useEffect, useRef, useMemo, useCallback } from "react";

const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
function kbd(s: string): string {
  if (!isMac) return s;
  return s.replace(/Ctrl\+Shift\+/g, "⌃⇧").replace(/Ctrl\+Alt\+/g, "⌃⌥").replace(/Ctrl\+/g, "⌘").replace(/Alt\+/g, "⌥").replace(/Shift\+/g, "⇧");
}

function fuzzyMatch(text: string, query: string): { score: number; indices: number[] } | null {
  const tLower = text.toLowerCase();
  const qLower = query.toLowerCase();
  const indices: number[] = [];
  let qi = 0;

  for (let ti = 0; ti < tLower.length && qi < qLower.length; ti++) {
    if (tLower[ti] === qLower[qi]) {
      indices.push(ti);
      qi++;
    }
  }

  if (qi < qLower.length) return null;

  // Score: exact > prefix > spread bonus
  let score = 0;
  if (tLower === qLower) score = 100;
  else if (tLower.startsWith(qLower)) score = 90;
  else score = 50;

  // Bonus for consecutive matches
  for (let i = 1; i < indices.length; i++) {
    if (indices[i] === indices[i - 1] + 1) score += 5;
  }
  // Bonus for word-boundary matches
  for (const idx of indices) {
    if (idx === 0 || text[idx - 1] === " " || text[idx - 1] === "-") score += 3;
  }
  // Penalty for spread
  if (indices.length > 1) {
    score -= (indices[indices.length - 1] - indices[0] - indices.length + 1) * 0.5;
  }

  return { score, indices };
}

function HighlightedText({ text, indices }: { text: string; indices: number[] }) {
  if (indices.length === 0) return <>{text}</>;
  const matchSet = new Set(indices);
  return (
    <>
      {text.split("").map((ch, i) =>
        matchSet.has(i) ? (
          <span key={i} style={{ color: "var(--accent-color)", fontWeight: 600 }}>{ch}</span>
        ) : (
          <span key={i}>{ch}</span>
        ),
      )}
    </>
  );
}

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
    if (!query) return commands.map((c) => ({ cmd: c, indices: [] as number[] }));
    const results: { cmd: Command; indices: number[]; score: number }[] = [];
    for (const cmd of commands) {
      const match = fuzzyMatch(cmd.name, query);
      if (match) results.push({ cmd, indices: match.indices, score: match.score });
    }
    results.sort((a, b) => b.score - a.score);
    return results;
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
          filtered[selectedIdx].cmd.action();
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
          background: "var(--bg-tertiary)",
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
            borderBottom: "1px solid var(--border-color)",
            background: "transparent",
            color: "var(--text-primary)",
            fontSize: 15,
            outline: "none",
          }}
        />
        <div style={{ overflow: "auto", flex: 1 }}>
          {filtered.map((item, i) => (
            <div
              key={item.cmd.id}
              ref={(el) => { if (el && i === selectedIdx) el.scrollIntoView({ block: "nearest" }); }}
              style={{
                padding: "8px 16px",
                cursor: "pointer",
                background: i === selectedIdx ? "var(--bg-hover)" : "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
              onClick={() => {
                item.cmd.action();
                onClose();
              }}
              onMouseEnter={() => setSelectedIdx(i)}
            >
              <span style={{ color: "var(--text-primary)", fontSize: 14 }}>
                <HighlightedText text={item.cmd.name} indices={item.indices} />
              </span>
              {item.cmd.shortcut && (
                <span
                  style={{
                    color: "var(--text-faint)",
                    fontSize: 11,
                    background: "var(--bg-primary)",
                    padding: "2px 6px",
                    borderRadius: 3,
                  }}
                >
                  {kbd(item.cmd.shortcut)}
                </span>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: "12px 16px", color: "var(--text-faint)", fontSize: 13 }}>
              No matching commands
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
