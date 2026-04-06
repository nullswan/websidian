import { useMemo } from "react";

interface StatusBarProps {
  content: string;
  path: string;
  cursorPos?: { line: number; col: number; selectedChars: number } | null;
  saveStatus?: "idle" | "saving" | "saved";
  fileCreated?: string;
  fileModified?: string;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function StatusBar({ content, path, cursorPos, saveStatus = "idle", fileCreated, fileModified }: StatusBarProps) {
  const stats = useMemo(() => {
    const text = content.replace(/^---[\t ]*\r?\n[\s\S]*?\n---[\t ]*(?:\r?\n|$)/, "");
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    const chars = text.length;
    const readingTime = Math.max(1, Math.ceil(words / 200));
    return { words, chars, readingTime };
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
      <span>{stats.chars.toLocaleString()} characters</span>
      <span>{stats.readingTime} min read</span>
      {fileCreated && <span title={`Created: ${fileCreated}`}>Created {formatDate(fileCreated)}</span>}
      {fileModified && <span title={`Modified: ${fileModified}`}>Modified {formatDate(fileModified)}</span>}
      {saveStatus === "saving" && (
        <span style={{ color: "#e6994a" }}>Saving...</span>
      )}
      {saveStatus === "saved" && (
        <span style={{ color: "#4ec9b0" }}>&#10003; Saved</span>
      )}
      {cursorPos && (
        <span style={{ marginLeft: "auto" }}>
          {cursorPos.selectedChars > 0 && `${cursorPos.selectedChars} selected  `}
          Ln {cursorPos.line}, Col {cursorPos.col}
        </span>
      )}
    </div>
  );
}
