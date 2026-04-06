import { useState, useEffect, useRef } from "react";

interface FolderPickerProps {
  folders: string[];
  currentPath: string;
  onSelect: (folder: string) => void;
  onClose: () => void;
}

export function FolderPicker({ folders, currentPath, onSelect, onClose }: FolderPickerProps) {
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const currentFolder = currentPath.includes("/") ? currentPath.split("/").slice(0, -1).join("/") : "(root)";
  const filtered = query.trim()
    ? folders.filter((f) => f.toLowerCase().includes(query.toLowerCase()))
    : folders;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (filtered[selectedIdx]) onSelect(filtered[selectedIdx]); }
    else if (e.key === "Escape") { onClose(); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "15vh", zIndex: 10000 }} onClick={onClose}>
      <div style={{ width: 400, maxWidth: "90vw", background: "var(--bg-tertiary)", border: "1px solid var(--border-color)", borderRadius: 8, overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "12px 12px 8px", fontSize: 12, color: "var(--text-muted)" }}>
          Move <strong style={{ color: "var(--text-primary)" }}>{currentPath.split("/").pop()}</strong> to folder
          {currentFolder !== "(root)" && <span style={{ color: "var(--text-faint)" }}> (currently in {currentFolder})</span>}
        </div>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSelectedIdx(0); }}
          onKeyDown={handleKeyDown}
          placeholder="Search folders..."
          style={{ width: "100%", padding: "8px 12px", background: "var(--bg-primary)", border: "none", borderTop: "1px solid var(--border-color)", borderBottom: "1px solid var(--border-color)", color: "var(--text-primary)", fontSize: 14, outline: "none", boxSizing: "border-box" }}
        />
        <div style={{ maxHeight: 300, overflow: "auto" }}>
          {filtered.map((folder, i) => (
            <div
              key={folder}
              onClick={() => onSelect(folder)}
              style={{
                padding: "6px 12px",
                cursor: "pointer",
                background: i === selectedIdx ? "rgba(127,109,242,0.15)" : "transparent",
                color: folder === currentFolder ? "var(--accent-color)" : "var(--text-primary)",
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
              onMouseEnter={() => setSelectedIdx(i)}
            >
              <span style={{ color: "var(--text-faint)", fontSize: 12 }}>{folder === "(root)" ? "/" : "\uD83D\uDCC1"}</span>
              <span>{folder === "(root)" ? "Vault root" : folder}</span>
              {folder === currentFolder && <span style={{ fontSize: 10, color: "var(--text-faint)", marginLeft: "auto" }}>current</span>}
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: "12px", color: "var(--text-faint)", fontSize: 13, textAlign: "center" }}>No matching folders</div>
          )}
        </div>
      </div>
    </div>
  );
}
