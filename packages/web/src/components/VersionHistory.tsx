import { useState, useMemo } from "react";

export interface NoteSnapshot {
  timestamp: number;
  content: string;
  words: number;
}

const MAX_SNAPSHOTS = 10;
const STORAGE_PREFIX = "note-history:";

export function saveSnapshot(path: string, content: string) {
  const key = STORAGE_PREFIX + path;
  const words = content.replace(/^---[\t ]*\r?\n[\s\S]*?\n---[\t ]*(?:\r?\n|$)/, "").trim().split(/\s+/).filter(Boolean).length;
  try {
    const existing: NoteSnapshot[] = JSON.parse(localStorage.getItem(key) ?? "[]");
    // Don't save if content is identical to the most recent snapshot
    if (existing.length > 0 && existing[0].content === content) return;
    existing.unshift({ timestamp: Date.now(), content, words });
    if (existing.length > MAX_SNAPSHOTS) existing.length = MAX_SNAPSHOTS;
    localStorage.setItem(key, JSON.stringify(existing));
  } catch { /* localStorage full or error */ }
}

export function getSnapshots(path: string): NoteSnapshot[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_PREFIX + path) ?? "[]");
  } catch { return []; }
}

interface VersionHistoryProps {
  path: string;
  currentContent: string;
  onRestore: (content: string) => void;
  onClose: () => void;
}

export function VersionHistory({ path, currentContent, onRestore, onClose }: VersionHistoryProps) {
  const snapshots = useMemo(() => getSnapshots(path), [path]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [showDiff, setShowDiff] = useState(false);

  const selected = selectedIdx !== null ? snapshots[selectedIdx] : null;

  const diffLines = useMemo(() => {
    if (!selected || !showDiff) return null;
    const oldLines = selected.content.split("\n");
    const newLines = currentContent.split("\n");
    const result: { type: "same" | "added" | "removed"; text: string }[] = [];
    const maxLen = Math.max(oldLines.length, newLines.length);
    // Simple line-by-line diff (not a real diff algorithm, but good enough for preview)
    let oi = 0, ni = 0;
    while (oi < oldLines.length || ni < newLines.length) {
      if (oi < oldLines.length && ni < newLines.length && oldLines[oi] === newLines[ni]) {
        result.push({ type: "same", text: oldLines[oi] });
        oi++; ni++;
      } else if (oi < oldLines.length && (ni >= newLines.length || !newLines.includes(oldLines[oi]))) {
        result.push({ type: "removed", text: oldLines[oi] });
        oi++;
      } else {
        result.push({ type: "added", text: newLines[ni] ?? "" });
        ni++;
      }
      if (result.length > maxLen + 100) break; // safety
    }
    return result;
  }, [selected, showDiff, currentContent]);

  function formatTime(ts: number): string {
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    if (isToday) return `Today ${time}`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + ` ${time}`;
  }

  function formatAgo(ts: number): string {
    const secs = Math.floor((Date.now() - ts) / 1000);
    if (secs < 60) return "just now";
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
    return `${Math.floor(secs / 86400)}d ago`;
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ width: 700, maxWidth: "90vw", maxHeight: "80vh", background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 8, display: "flex", overflow: "hidden" }}>
        {/* Left: snapshot list */}
        <div style={{ width: 220, borderRight: "1px solid var(--border-color)", overflow: "auto", padding: "12px 0" }}>
          <div style={{ padding: "0 12px 8px", fontSize: 12, fontWeight: 600, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Version History
          </div>
          {snapshots.length === 0 ? (
            <div style={{ padding: "8px 12px", fontSize: 12, color: "var(--text-faint)" }}>No saved versions</div>
          ) : (
            snapshots.map((snap, i) => {
              const wordDelta = i < snapshots.length - 1 ? snap.words - snapshots[i + 1].words : 0;
              return (
                <div
                  key={snap.timestamp}
                  onClick={() => { setSelectedIdx(i); setShowDiff(false); }}
                  style={{
                    padding: "6px 12px 6px 28px",
                    cursor: "pointer",
                    background: selectedIdx === i ? "var(--bg-hover)" : "transparent",
                    position: "relative",
                  }}
                >
                  {/* Timeline vertical line */}
                  <div style={{
                    position: "absolute",
                    left: 14,
                    top: 0,
                    bottom: 0,
                    width: 2,
                    background: i === snapshots.length - 1 ? "transparent" : "var(--border-color)",
                  }} />
                  {/* Timeline dot */}
                  <div style={{
                    position: "absolute",
                    left: 10,
                    top: 12,
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: selectedIdx === i ? "var(--accent-color)" : "var(--bg-tertiary)",
                    border: `2px solid ${selectedIdx === i ? "var(--accent-color)" : "var(--text-faint)"}`,
                    zIndex: 1,
                  }} />
                  <div style={{ fontSize: 12, color: selectedIdx === i ? "var(--accent-color)" : "var(--text-primary)", fontWeight: selectedIdx === i ? 600 : 500 }}>{formatTime(snap.timestamp)}</div>
                  <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2, display: "flex", gap: 6 }}>
                    <span>{formatAgo(snap.timestamp)}</span>
                    <span>·</span>
                    <span>{snap.words}w</span>
                    {wordDelta !== 0 && (
                      <span style={{ color: wordDelta > 0 ? "var(--color-green)" : "var(--color-red)" }}>
                        {wordDelta > 0 ? "+" : ""}{wordDelta}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right: preview/diff */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "8px 16px", borderBottom: "1px solid var(--border-color)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, color: "var(--text-primary)" }}>
              {selected ? formatTime(selected.timestamp) : "Select a version"}
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              {selected && (
                <>
                  <button
                    onClick={() => setShowDiff(!showDiff)}
                    style={{
                      background: showDiff ? "rgba(127,109,242,0.15)" : "var(--bg-tertiary)",
                      border: "1px solid var(--border-color)",
                      borderRadius: 4,
                      padding: "3px 10px",
                      fontSize: 11,
                      color: showDiff ? "var(--accent-color)" : "var(--text-muted)",
                      cursor: "pointer",
                    }}
                  >
                    Diff
                  </button>
                  <button
                    onClick={() => { onRestore(selected.content); onClose(); }}
                    style={{
                      background: "var(--accent-color)",
                      border: "none",
                      borderRadius: 4,
                      padding: "3px 12px",
                      fontSize: 11,
                      color: "#fff",
                      cursor: "pointer",
                    }}
                  >
                    Restore
                  </button>
                </>
              )}
              <button
                onClick={onClose}
                style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 16, cursor: "pointer", padding: "2px 6px" }}
              >
                ✕
              </button>
            </div>
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: 16, fontSize: 13, fontFamily: "monospace", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
            {!selected && <span style={{ color: "var(--text-faint)" }}>Select a version from the left to preview</span>}
            {selected && !showDiff && (
              <pre style={{ margin: 0, color: "var(--text-secondary)", fontFamily: "inherit" }}>{selected.content}</pre>
            )}
            {selected && showDiff && diffLines && (
              <div>
                {diffLines.map((line, i) => (
                  <div
                    key={i}
                    style={{
                      background: line.type === "added" ? "rgba(76,175,80,0.1)" : line.type === "removed" ? "rgba(244,67,54,0.1)" : "transparent",
                      color: line.type === "added" ? "var(--color-green)" : line.type === "removed" ? "var(--color-red)" : "var(--text-secondary)",
                      padding: "0 4px",
                      borderLeft: line.type !== "same" ? `3px solid ${line.type === "added" ? "var(--color-green)" : "var(--color-red)"}` : "3px solid transparent",
                    }}
                  >
                    {line.type === "added" ? "+" : line.type === "removed" ? "-" : " "} {line.text}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
