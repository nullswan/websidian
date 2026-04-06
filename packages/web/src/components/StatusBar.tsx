import { useMemo, useState, useEffect } from "react";

interface StatusBarProps {
  content: string;
  path: string;
  cursorPos?: { line: number; col: number; selectedChars: number; selectedWords?: number; cursors?: number } | null;
  saveStatus?: "idle" | "saving" | "saved";
  fileCreated?: string;
  fileModified?: string;
  scrollProgress?: number;
  lineWrap?: boolean;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

let vaultStatsCache: { totalNotes: number; totalWords: number } | null = null;

export function StatusBar({ content, path, cursorPos, saveStatus = "idle", fileCreated, fileModified, scrollProgress, lineWrap }: StatusBarProps) {
  const [vaultStats, setVaultStats] = useState(vaultStatsCache);

  useEffect(() => {
    if (vaultStatsCache) { setVaultStats(vaultStatsCache); return; }
    fetch("/api/vault/stats", { credentials: "include" })
      .then(r => r.json())
      .then((d: { totalNotes: number; totalWords: number }) => {
        vaultStatsCache = d;
        setVaultStats(d);
      })
      .catch(() => {});
  }, []);

  const stats = useMemo(() => {
    const text = content.replace(/^---[\t ]*\r?\n[\s\S]*?\n---[\t ]*(?:\r?\n|$)/, "");
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    const chars = text.length;
    const readingTime = Math.max(1, Math.ceil(words / 200));
    // Parse wordGoal from frontmatter
    let wordGoal = 0;
    const fmMatch = content.match(/^---[\t ]*\r?\n([\s\S]*?)\n---/);
    if (fmMatch) {
      const goalMatch = fmMatch[1].match(/wordGoal:\s*(\d+)/i);
      if (goalMatch) wordGoal = parseInt(goalMatch[1], 10);
    }
    // Task checkboxes
    const totalTasks = (content.match(/^[\t ]*- \[[ x]\]/gm) ?? []).length;
    const doneTasks = (content.match(/^[\t ]*- \[x\]/gm) ?? []).length;
    // Link counts
    const internalLinks = (text.match(/\[\[[^\]]+\]\]/g) ?? []).length;
    const externalLinks = (text.match(/(?:^|[^(])(https?:\/\/[^\s)>\]]+)/gm) ?? []).length;
    return { words, chars, readingTime, wordGoal, totalTasks, doneTasks, internalLinks, externalLinks };
  }, [content]);

  const fileName = path.split("/").pop() ?? path;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "2px 12px",
        borderTop: "1px solid var(--border-color)",
        background: "var(--bg-primary)",
        color: "var(--text-faint)",
        fontSize: 11,
        flexShrink: 0,
        userSelect: "none",
      }}
    >
      <span>{fileName}</span>
      <span>{stats.words.toLocaleString()} words</span>
      {stats.wordGoal > 0 && (() => {
        const pct = Math.min(stats.words / stats.wordGoal, 1);
        const r = 7;
        const circ = 2 * Math.PI * r;
        const offset = circ * (1 - pct);
        const color = pct >= 1 ? "#4caf50" : "var(--accent-color)";
        return (
          <span
            style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
            title={`${stats.words}/${stats.wordGoal} words (${Math.round(pct * 100)}%)`}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="9" cy="9" r={r} fill="none" stroke="var(--border-color)" strokeWidth="2" />
              <circle cx="9" cy="9" r={r} fill="none" stroke={color} strokeWidth="2"
                strokeDasharray={circ} strokeDashoffset={offset}
                strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.3s" }} />
            </svg>
            <span style={{ color: pct >= 1 ? "#4caf50" : undefined }}>{Math.round(pct * 100)}%</span>
          </span>
        );
      })()}
      <span>{stats.chars.toLocaleString()} characters</span>
      <span>{stats.readingTime} min read</span>
      {stats.totalTasks > 0 && (
        <span style={{ color: stats.doneTasks === stats.totalTasks ? "#4caf50" : undefined }}>
          {stats.doneTasks}/{stats.totalTasks} tasks
        </span>
      )}
      {(stats.internalLinks > 0 || stats.externalLinks > 0) && (
        <span title={`${stats.internalLinks} internal, ${stats.externalLinks} external links`}>
          {stats.internalLinks > 0 && <>{stats.internalLinks} links</>}
          {stats.internalLinks > 0 && stats.externalLinks > 0 && " · "}
          {stats.externalLinks > 0 && <>{stats.externalLinks} ext</>}
        </span>
      )}
      {fileCreated && <span title={`Created: ${fileCreated}`}>Created {formatDate(fileCreated)}</span>}
      {fileModified && <span title={`Modified: ${fileModified}`}>Modified {formatDate(fileModified)}</span>}
      {vaultStats && (
        <span title={`Vault: ${vaultStats.totalNotes.toLocaleString()} notes, ${vaultStats.totalWords.toLocaleString()} words`} style={{ opacity: 0.7 }}>
          Vault: {vaultStats.totalWords.toLocaleString()}w
        </span>
      )}
      {lineWrap != null && (
        <span style={{ opacity: 0.6 }}>{lineWrap ? "Wrap" : "No Wrap"}</span>
      )}
      {saveStatus === "saving" && (
        <span style={{ color: "#e6994a" }}>Saving...</span>
      )}
      {saveStatus === "saved" && (
        <span style={{ color: "#4ec9b0" }}>&#10003; Saved</span>
      )}
      {cursorPos && (
        <span style={{ marginLeft: "auto" }}>
          {(cursorPos.cursors ?? 1) > 1 && (
            <span style={{ color: "var(--accent-color)", marginRight: 8 }}>{cursorPos.cursors} cursors</span>
          )}
          {cursorPos.selectedChars > 0 && `${cursorPos.selectedChars} chars (${cursorPos.selectedWords ?? 0} words) selected  `}
          Ln {cursorPos.line}, Col {cursorPos.col}
        </span>
      )}
      {scrollProgress != null && !cursorPos && (
        <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: scrollProgress >= 0.95 ? "#4ec9b0" : undefined }}>
            {Math.round(scrollProgress * 100)}% read
          </span>
        </span>
      )}
    </div>
  );
}
