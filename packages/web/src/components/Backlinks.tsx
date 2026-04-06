import React, { useState, useRef, useEffect } from "react";
import { createMarkdownRenderer } from "../lib/markdown.js";

interface BacklinksProps {
  backlinks: Array<{ path: string; context: string; lineContext?: string }>;
  onNavigate: (path: string) => void;
}

const previewMd = createMarkdownRenderer();

export const Backlinks = React.memo(function Backlinks({ backlinks, onNavigate }: BacklinksProps) {
  const [hoverPreview, setHoverPreview] = useState<{ path: string; html: string; x: number; y: number } | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  useEffect(() => {
    return () => { if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current); };
  }, []);

  const handleMouseEnter = (path: string, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      fetch(`/api/vault/file?path=${encodeURIComponent(path)}`, { credentials: "include" })
        .then((r) => r.json())
        .then((data) => {
          if (data.error) return;
          let preview = data.content as string;
          const fmMatch = /^---[\t ]*\r?\n[\s\S]*?\n---[\t ]*(?:\r?\n|$)/.exec(preview);
          if (fmMatch) preview = preview.slice(fmMatch[0].length);
          if (preview.length > 600) preview = preview.slice(0, 600) + "\n\n...";
          setHoverPreview({ path, html: previewMd.render(preview), x: rect.right + 8, y: rect.top });
        })
        .catch(() => {});
    }, 300);
  };

  const handleMouseLeave = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setHoverPreview(null);
  };

  if (backlinks.length === 0) {
    return (
      <div style={{ padding: "4px 12px", fontSize: 12, color: "var(--text-faint)" }}>
        No backlinks
      </div>
    );
  }

  // Group backlinks by source note path
  const grouped = new Map<string, Array<{ context: string; lineContext?: string }>>();
  for (const bl of backlinks) {
    if (!grouped.has(bl.path)) grouped.set(bl.path, []);
    grouped.get(bl.path)!.push({ context: bl.context, lineContext: bl.lineContext });
  }

  const sortedEntries = [...grouped.entries()].sort((a, b) => {
    const nameA = (a[0].split("/").pop() ?? "").toLowerCase();
    const nameB = (b[0].split("/").pop() ?? "").toLowerCase();
    return sortAsc ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
  });

  return (
    <div style={{ padding: "4px 12px 8px" }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
        <button
          onClick={() => setSortAsc((v) => !v)}
          title={sortAsc ? "Sort Z→A" : "Sort A→Z"}
          style={{ background: "none", border: "none", color: "var(--text-faint)", cursor: "pointer", fontSize: 11, padding: "1px 4px" }}
        >
          {sortAsc ? "A↓" : "Z↓"}
        </button>
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {sortedEntries.map(([path, entries]) => (
          <li key={path} style={{ marginBottom: 8 }}>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                onNavigate(path);
              }}
              onMouseEnter={(e) => handleMouseEnter(path, e)}
              onMouseLeave={handleMouseLeave}
              title={path}
              style={{
                color: "var(--accent-color)",
                textDecoration: "none",
                fontSize: 13,
                display: "block",
              }}
            >
              {path.replace(/\.md$/, "").split("/").pop()}
            </a>
            {entries.map((entry, i) => {
              const text = entry.lineContext || entry.context;
              // Strip wikilink syntax for cleaner display
              const cleaned = text
                .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
                .replace(/\[\[([^\]]+)\]\]/g, "$1")
                .replace(/^>\s*/, "")
                .replace(/^[-*]\s+/, "");
              return (
                <div key={i} style={{
                  fontSize: 11,
                  color: "var(--text-secondary)",
                  marginTop: 2,
                  padding: "2px 0 2px 8px",
                  borderLeft: "2px solid var(--border-color)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {cleaned}
                </div>
              );
            })}
          </li>
        ))}
      </ul>
      {hoverPreview && (
        <div
          className="hover-preview reader-view"
          onMouseLeave={handleMouseLeave}
          style={{
            position: "fixed",
            left: Math.min(hoverPreview.x, window.innerWidth - 340),
            top: Math.min(hoverPreview.y, window.innerHeight - 260),
            width: 320,
            maxHeight: 240,
            overflow: "auto",
            zIndex: 1000,
          }}
          dangerouslySetInnerHTML={{ __html: hoverPreview.html }}
        />
      )}
    </div>
  );
});
