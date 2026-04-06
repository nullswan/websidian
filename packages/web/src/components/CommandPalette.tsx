import { useState, useEffect, useRef, useMemo, useCallback, Fragment } from "react";

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

const RECENT_KEY = "command-palette-recent";
const MAX_RECENT = 8;

function getRecentIds(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]"); }
  catch { return []; }
}

function pushRecent(id: string) {
  const recent = getRecentIds().filter((r) => r !== id);
  recent.unshift(id);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

export function CommandPalette({ commands, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = useMemo(() => {
    if (!query) {
      // Show recent commands first, then all commands
      const recentIds = getRecentIds();
      const recentSet = new Set(recentIds);
      const cmdMap = new Map(commands.map((c) => [c.id, c]));
      const recentCmds = recentIds.map((id) => cmdMap.get(id)).filter(Boolean) as Command[];
      const restCmds = commands.filter((c) => !recentSet.has(c.id));
      return [
        ...recentCmds.map((c) => ({ cmd: c, indices: [] as number[], isRecent: true })),
        ...restCmds.map((c) => ({ cmd: c, indices: [] as number[], isRecent: false })),
      ];
    }
    const results: { cmd: Command; indices: number[]; score: number; isRecent: boolean }[] = [];
    for (const cmd of commands) {
      const match = fuzzyMatch(cmd.name, query);
      if (match) results.push({ cmd, indices: match.indices, score: match.score, isRecent: false });
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
          pushRecent(filtered[selectedIdx].cmd.id);
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
            <Fragment key={item.cmd.id}>
              {!query && i === 0 && item.isRecent && (
                <div style={{ padding: "6px 16px 2px", fontSize: 10, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Recent</div>
              )}
              {!query && i > 0 && !item.isRecent && filtered[i - 1]?.isRecent && (
                <div style={{ padding: "6px 16px 2px", fontSize: 10, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em", borderTop: "1px solid var(--border-color)", marginTop: 4 }}>All Commands</div>
              )}
            <div
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
                pushRecent(item.cmd.id);
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
            </Fragment>
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
