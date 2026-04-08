import React, { useState, useEffect, useRef, useMemo } from "react";
import type { VaultEntry } from "../types.js";

interface DiffViewProps {
  diffSource: string;
  tree: VaultEntry[];
  onClose: () => void;
}

export function DiffView({ diffSource, tree, onClose }: DiffViewProps) {
  const [targetPath, setTargetPath] = useState("");
  const [sourceContent, setSourceContent] = useState("");
  const [targetContent, setTargetContent] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    fetch(`/api/vault/file?path=${encodeURIComponent(diffSource)}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (!d.error) setSourceContent(d.content); });
  }, [diffSource]);

  const allPaths = useMemo(() => {
    const paths: string[] = [];
    const walk = (entries: VaultEntry[]) => {
      for (const e of entries) {
        if (e.kind === "file" && e.path.endsWith(".md") && e.path !== diffSource) paths.push(e.path);
        if (e.kind === "folder") walk(e.children);
      }
    };
    walk(tree);
    return paths;
  }, [tree, diffSource]);

  const filtered = useMemo(() => {
    if (!query) return allPaths.slice(0, 15);
    const q = query.toLowerCase();
    return allPaths.filter((p) => p.toLowerCase().includes(q)).slice(0, 15);
  }, [query, allPaths]);

  const selectTarget = (path: string) => {
    setTargetPath(path);
    fetch(`/api/vault/file?path=${encodeURIComponent(path)}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (!d.error) { setTargetContent(d.content); setLoaded(true); } });
  };

  const diffLines = useMemo(() => {
    if (!loaded) return [];
    const a = sourceContent.split("\n");
    const b = targetContent.split("\n");
    const result: Array<{ type: "same" | "add" | "remove"; text: string }> = [];
    const bSet = new Set(b);
    const aSet = new Set(a);
    let ai = 0, bi = 0;
    while (ai < a.length || bi < b.length) {
      if (ai < a.length && bi < b.length && a[ai] === b[bi]) {
        result.push({ type: "same", text: a[ai] });
        ai++; bi++;
      } else if (ai < a.length && !bSet.has(a[ai])) {
        result.push({ type: "remove", text: a[ai] });
        ai++;
      } else if (bi < b.length && !aSet.has(b[bi])) {
        result.push({ type: "add", text: b[bi] });
        bi++;
      } else if (ai < a.length) {
        result.push({ type: "remove", text: a[ai] });
        ai++;
      } else if (bi < b.length) {
        result.push({ type: "add", text: b[bi] });
        bi++;
      }
    }
    return result;
  }, [loaded, sourceContent, targetContent]);

  const addCount = diffLines.filter((d) => d.type === "add").length;
  const removeCount = diffLines.filter((d) => d.type === "remove").length;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: 800, maxWidth: "95vw", maxHeight: "85vh", background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 8, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-color)", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Compare</span>
          <span style={{ fontSize: 12, color: "var(--accent-color)" }}>{diffSource.replace(/\.md$/, "").split("/").pop()}</span>
          <span style={{ fontSize: 12, color: "var(--text-faint)" }}>vs</span>
          {loaded ? (
            <span style={{ fontSize: 12, color: "var(--accent-color)" }}>{targetPath.replace(/\.md$/, "").split("/").pop()}</span>
          ) : (
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for note to compare..."
              onKeyDown={(e) => { if (e.key === "Escape") onClose(); if (e.key === "Enter" && filtered.length > 0) selectTarget(filtered[0]); }}
              style={{ flex: 1, padding: "4px 8px", background: "var(--bg-tertiary)", border: "1px solid var(--border-color)", borderRadius: 4, color: "var(--text-primary)", fontSize: 12, outline: "none" }}
            />
          )}
          {loaded && (
            <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-faint)" }}>
              <span style={{ color: "var(--color-green)" }}>+{addCount}</span> / <span style={{ color: "var(--color-red)" }}>-{removeCount}</span>
            </span>
          )}
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 16, cursor: "pointer", marginLeft: loaded ? 0 : "auto" }}>✕</button>
        </div>
        {!loaded ? (
          <div style={{ flex: 1, overflow: "auto", padding: 8 }}>
            {filtered.map((p) => (
              <div key={p} onClick={() => selectTarget(p)} style={{ padding: "6px 12px", cursor: "pointer", borderRadius: 4, fontSize: 13, color: "var(--text-primary)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(127,109,242,0.08)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                {p.replace(/\.md$/, "")}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ flex: 1, overflow: "auto", fontFamily: "monospace", fontSize: 12, lineHeight: 1.6 }}>
            {diffLines.map((d, i) => (
              <div key={i} style={{
                padding: "0 16px",
                background: d.type === "add" ? "rgba(78, 201, 176, 0.1)" : d.type === "remove" ? "rgba(224, 82, 82, 0.1)" : "transparent",
                color: d.type === "add" ? "var(--color-green)" : d.type === "remove" ? "var(--color-red)" : "var(--text-secondary)",
                borderLeft: d.type === "add" ? "3px solid var(--color-green)" : d.type === "remove" ? "3px solid var(--color-red)" : "3px solid transparent",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}>
                <span style={{ display: "inline-block", width: 16, color: "var(--text-faint)", userSelect: "none" }}>
                  {d.type === "add" ? "+" : d.type === "remove" ? "−" : " "}
                </span>
                {d.text || " "}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
