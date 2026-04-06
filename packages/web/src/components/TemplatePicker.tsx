import { useState, useEffect, useRef } from "react";
import type { VaultEntry } from "../types.js";

interface TemplatePickerProps {
  templatesFolder: string;
  onSelect: (path: string) => void;
  onClose: () => void;
}

export function TemplatePicker({ templatesFolder, onSelect, onClose }: TemplatePickerProps) {
  const [templates, setTemplates] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/vault/tree", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        const paths: string[] = [];
        const walk = (entries: VaultEntry[]) => {
          for (const e of entries) {
            if (e.kind === "folder" && e.children) {
              walk(e.children);
            } else if (e.path.startsWith(templatesFolder + "/") && e.path.endsWith(".md")) {
              paths.push(e.path);
            }
          }
        };
        walk(data.tree ?? data);
        setTemplates(paths);
      });
    inputRef.current?.focus();
  }, [templatesFolder]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const filtered = filter
    ? templates.filter((p) => p.toLowerCase().includes(filter.toLowerCase()))
    : templates;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "15vh",
        background: "rgba(0,0,0,0.5)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: 500,
        maxWidth: "90vw",
        background: "var(--bg-secondary)",
        border: "1px solid var(--border-color)",
        borderRadius: 8,
        overflow: "hidden",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
      }}>
        <input
          ref={inputRef}
          value={filter}
          onChange={(e) => { setFilter(e.target.value); setSelected(0); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setSelected((s) => Math.min(s + 1, filtered.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
            if (e.key === "Enter" && filtered[selected]) { onSelect(filtered[selected]); }
          }}
          placeholder="Choose a template..."
          style={{
            width: "100%",
            padding: "12px 16px",
            background: "transparent",
            border: "none",
            borderBottom: "1px solid var(--border-color)",
            color: "var(--text-primary)",
            fontSize: 15,
            outline: "none",
          }}
        />
        <div style={{ maxHeight: 300, overflow: "auto" }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 16, fontSize: 13, color: "var(--text-faint)" }}>
              {templates.length === 0
                ? `No templates found in "${templatesFolder}/" folder`
                : "No matching templates"}
            </div>
          ) : (
            filtered.map((path, i) => {
              const name = path.replace(/\.md$/, "").split("/").pop() ?? path;
              return (
                <div
                  key={path}
                  onClick={() => onSelect(path)}
                  style={{
                    padding: "8px 16px",
                    cursor: "pointer",
                    background: i === selected ? "var(--bg-hover)" : "transparent",
                    color: i === selected ? "var(--text-primary)" : "var(--text-secondary)",
                    fontSize: 14,
                  }}
                  onMouseEnter={() => setSelected(i)}
                >
                  {name}
                  <span style={{ fontSize: 11, color: "var(--text-faint)", marginLeft: 8 }}>
                    {path}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
