import { useMemo, useState, useEffect } from "react";
import { isDemoMode } from "../demoApi.js";

interface StatusBarProps {
  content: string;
  path: string;
  cursorPos?: { line: number; col: number; selectedChars: number; selectedWords?: number; selectedLines?: number; cursors?: number } | null;
  saveStatus?: "idle" | "saving" | "saved";
  fileCreated?: string;
  fileModified?: string;
  scrollProgress?: number;
  lineWrap?: boolean;
  onToggleLineWrap?: () => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

let vaultStatsCache: { totalNotes: number; totalWords: number } | null = null;

export function StatusBar({ content, path, cursorPos, saveStatus = "idle", fileCreated, fileModified, scrollProgress, lineWrap, onToggleLineWrap }: StatusBarProps) {
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
    const footnotes = (text.match(/^\[\^\w+\]:/gm) ?? []).length;
    return { words, chars, readingTime, wordGoal, totalTasks, doneTasks, internalLinks, externalLinks, footnotes };
  }, [content]);

  // Track word count history for sparkline
  const wordHistory = useMemo(() => {
    try {
      const raw = localStorage.getItem(`wc-history:${path}`);
      return raw ? (JSON.parse(raw) as number[]) : [];
    } catch { return []; }
  }, [path, saveStatus]);

  useEffect(() => {
    if (saveStatus !== "saved" || !stats.words) return;
    try {
      const key = `wc-history:${path}`;
      const raw = localStorage.getItem(key);
      const history: number[] = raw ? JSON.parse(raw) : [];
      // Only append if different from last entry
      if (history.length === 0 || history[history.length - 1] !== stats.words) {
        history.push(stats.words);
        if (history.length > 20) history.splice(0, history.length - 20);
        localStorage.setItem(key, JSON.stringify(history));
      }
    } catch {}
  }, [saveStatus, path, stats.words]);

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
      <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
        {(() => {
          const parts = path.split("/");
          const file = parts.pop() ?? path;
          return (
            <>
              {parts.map((seg, i) => (
                <span key={i}>
                  <span style={{ opacity: 0.5 }}>{seg}</span>
                  <span style={{ opacity: 0.3, margin: "0 1px" }}>/</span>
                </span>
              ))}
              <span style={{ color: "var(--text-secondary)" }}>{file}</span>
            </>
          );
        })()}
      </span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        {stats.words.toLocaleString()} words
        {wordHistory.length >= 3 && (() => {
          const h = wordHistory;
          const min = Math.min(...h);
          const max = Math.max(...h);
          const range = max - min || 1;
          const w = 40;
          const ht = 12;
          const points = h.map((v, i) => `${(i / (h.length - 1)) * w},${ht - ((v - min) / range) * ht}`).join(" ");
          const trend = h[h.length - 1] >= h[0] ? "#4ec9b0" : "#e05252";
          return (
            <svg width={w} height={ht} viewBox={`0 0 ${w} ${ht}`} style={{ opacity: 0.7 }}>
              <polyline points={points} fill="none" stroke={trend} strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
          );
        })()}
      </span>
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
      {stats.totalTasks > 0 && (() => {
        const pct = stats.doneTasks / stats.totalTasks;
        const done = stats.doneTasks === stats.totalTasks;
        const barColor = done ? "#4caf50" : "var(--accent-color)";
        return (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: done ? "#4caf50" : undefined }}>
            <span style={{ display: "inline-block", width: 40, height: 4, background: "var(--border-color)", borderRadius: 2, overflow: "hidden" }}>
              <span style={{ display: "block", width: `${pct * 100}%`, height: "100%", background: barColor, borderRadius: 2, transition: "width 0.3s" }} />
            </span>
            {stats.doneTasks}/{stats.totalTasks} tasks
          </span>
        );
      })()}
      {(stats.internalLinks > 0 || stats.externalLinks > 0) && (
        <span title={`${stats.internalLinks} internal, ${stats.externalLinks} external links`}>
          {stats.internalLinks > 0 && <>{stats.internalLinks} links</>}
          {stats.internalLinks > 0 && stats.externalLinks > 0 && " · "}
          {stats.externalLinks > 0 && <>{stats.externalLinks} ext</>}
        </span>
      )}
      {stats.footnotes > 0 && (
        <span title={`${stats.footnotes} footnote${stats.footnotes !== 1 ? "s" : ""}`}>{stats.footnotes} fn</span>
      )}
      {fileCreated && <span title={`Created: ${fileCreated}`}>Created {formatDate(fileCreated)}</span>}
      {fileModified && <span title={`Modified: ${fileModified}`}>Modified {formatDate(fileModified)}</span>}
      {vaultStats && (
        <span title={`Vault: ${vaultStats.totalNotes.toLocaleString()} notes, ${vaultStats.totalWords.toLocaleString()} words`} style={{ opacity: 0.7 }}>
          Vault: {vaultStats.totalNotes.toLocaleString()} notes · {vaultStats.totalWords.toLocaleString()}w
        </span>
      )}
      {lineWrap != null && (
        <span
          style={{ opacity: 0.6, cursor: onToggleLineWrap ? "pointer" : undefined }}
          onClick={onToggleLineWrap}
          title="Toggle word wrap"
        >
          {lineWrap ? "Wrap" : "No Wrap"}
        </span>
      )}
      {saveStatus === "saving" && (
        <span style={{ color: "#e6994a", display: "inline-flex", alignItems: "center", gap: 4 }}>
          <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#e6994a", animation: "save-pulse 1s ease-in-out infinite" }} />
          Saving
        </span>
      )}
      {saveStatus === "saved" && (
        <span style={{ color: "#4ec9b0", display: "inline-flex", alignItems: "center", gap: 3, animation: "save-fade-in 0.25s ease-out" }}>
          <svg width="12" height="12" viewBox="0 0 12 12" style={{ flexShrink: 0 }}>
            <path d="M2 6l3 3 5-5" fill="none" stroke="#4ec9b0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ strokeDasharray: 14, strokeDashoffset: 0, animation: "save-check-draw 0.35s ease-out" }} />
          </svg>
          Saved
        </span>
      )}
      {cursorPos && (
        <span style={{ marginLeft: "auto" }}>
          {(cursorPos.cursors ?? 1) > 1 && (
            <span style={{ color: "var(--accent-color)", marginRight: 8 }}>{cursorPos.cursors} cursors</span>
          )}
          {cursorPos.selectedChars > 0 && (
            <span
              style={{ cursor: "pointer" }}
              title="Click to copy selection"
              onClick={() => { document.execCommand("copy"); }}
            >
              {cursorPos.selectedChars} chars, {cursorPos.selectedWords ?? 0} words{(cursorPos.selectedLines ?? 0) > 1 ? `, ${cursorPos.selectedLines} lines` : ""} selected&nbsp;&nbsp;
            </span>
          )}
          Ln {cursorPos.line}, Col {cursorPos.col}
        </span>
      )}
      <span style={{ marginLeft: cursorPos ? 8 : "auto", color: "var(--text-faint)" }}>
        {content.includes("\r\n") ? "CRLF" : "LF"}
      </span>
      <span style={{ color: "var(--text-faint)", marginLeft: 8 }}>UTF-8</span>
      <span style={{ color: "var(--text-faint)", marginLeft: 8 }}>Markdown</span>
      {isDemoMode() && (
        <span
          title="Running in demo mode with an embedded vault. Run npx websidian /path/to/vault to use your own."
          style={{
            marginLeft: 8,
            fontSize: 9,
            padding: "1px 5px",
            borderRadius: 3,
            background: "rgba(127,109,242,0.15)",
            color: "var(--accent-color)",
            fontWeight: 600,
            letterSpacing: 0.5,
          }}
        >
          DEMO
        </span>
      )}
      {scrollProgress != null && !cursorPos && (() => {
        const pct = scrollProgress;
        const r = 6;
        const circ = 2 * Math.PI * r;
        const offset = circ * (1 - pct);
        const done = pct >= 0.95;
        const color = done ? "#4ec9b0" : "var(--accent-color)";
        return (
          <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
              <circle cx="8" cy="8" r={r} fill="none" stroke="var(--border-color)" strokeWidth="1.5" />
              <circle cx="8" cy="8" r={r} fill="none" stroke={color} strokeWidth="1.5"
                strokeDasharray={circ} strokeDashoffset={offset}
                strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.3s ease" }} />
            </svg>
            <span style={{ color: done ? "#4ec9b0" : undefined }}>
              {Math.round(pct * 100)}%
            </span>
          </span>
        );
      })()}
    </div>
  );
}
