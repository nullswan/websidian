import { useMemo } from "react";

interface StatusBarProps {
  content: string;
  path: string;
  cursorPos?: { line: number; col: number; selectedChars: number } | null;
}

export function StatusBar({ content, path, cursorPos }: StatusBarProps) {
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
        borderTop: "1px solid #333",
        background: "#1e1e1e",
        color: "#666",
        fontSize: 11,
        flexShrink: 0,
        userSelect: "none",
      }}
    >
      <span>{fileName}</span>
      <span>{stats.words.toLocaleString()} words</span>
      <span>{stats.chars.toLocaleString()} characters</span>
      <span>{stats.readingTime} min read</span>
      {cursorPos && (
        <span style={{ marginLeft: "auto" }}>
          {cursorPos.selectedChars > 0 && `${cursorPos.selectedChars} selected  `}
          Ln {cursorPos.line}, Col {cursorPos.col}
        </span>
      )}
    </div>
  );
}
