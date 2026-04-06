import { useState, useEffect } from "react";

interface BrokenLink {
  source: string;
  target: string;
}

interface BrokenLinkReportProps {
  onClose: () => void;
  onNavigate: (path: string) => void;
  onCreateNote?: (title: string) => void;
}

export function BrokenLinkReport({ onClose, onNavigate, onCreateNote }: BrokenLinkReportProps) {
  const [loading, setLoading] = useState(true);
  const [brokenLinks, setBrokenLinks] = useState<BrokenLink[]>([]);

  useEffect(() => {
    fetch("/api/vault/graph", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        const nodeIds = new Set<string>((data.nodes ?? []).map((n: { id: string }) => n.id));
        // Also build a set of basenames for fuzzy matching
        const basenames = new Set<string>();
        for (const id of nodeIds) {
          const base = id.replace(/\.md$/, "").split("/").pop()?.toLowerCase();
          if (base) basenames.add(base);
        }
        const broken: BrokenLink[] = [];
        for (const edge of data.edges ?? []) {
          const target = edge.target as string;
          if (!nodeIds.has(target)) {
            // Also check if target matches any basename (partial resolution)
            const targetBase = target.replace(/\.md$/, "").split("/").pop()?.toLowerCase() ?? "";
            if (!basenames.has(targetBase)) {
              broken.push({ source: edge.source, target });
            }
          }
        }
        setBrokenLinks(broken);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Group by source note
  const grouped = new Map<string, string[]>();
  for (const bl of brokenLinks) {
    if (!grouped.has(bl.source)) grouped.set(bl.source, []);
    grouped.get(bl.source)!.push(bl.target);
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ width: 560, maxWidth: "90vw", maxHeight: "80vh", background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 8, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
            Broken Links Report
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 18, cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
          {loading ? (
            <div style={{ color: "var(--text-faint)", fontSize: 13 }}>Scanning vault...</div>
          ) : brokenLinks.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>&#10003;</div>
              <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>No broken links found!</div>
              <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 4 }}>All wikilinks resolve to existing notes.</div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: "var(--text-faint)", marginBottom: 12 }}>
                Found {brokenLinks.length} broken link{brokenLinks.length !== 1 ? "s" : ""} across {grouped.size} note{grouped.size !== 1 ? "s" : ""}
              </div>
              {[...grouped.entries()].map(([source, targets]) => {
                const name = source.replace(/\.md$/, "").split("/").pop() ?? source;
                return (
                  <div key={source} style={{ marginBottom: 12 }}>
                    <div
                      onClick={() => { onNavigate(source); onClose(); }}
                      style={{
                        fontSize: 13,
                        color: "var(--accent-color)",
                        cursor: "pointer",
                        fontWeight: 600,
                        marginBottom: 4,
                      }}
                    >
                      {name}
                      <span style={{ fontWeight: 400, color: "var(--text-faint)", fontSize: 11, marginLeft: 6 }}>
                        {targets.length} broken
                      </span>
                    </div>
                    {targets.map((target, i) => {
                      const targetName = target.replace(/\.md$/, "").split("/").pop() ?? target;
                      return (
                        <div
                          key={i}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "3px 0 3px 12px",
                            borderLeft: "2px solid var(--border-color)",
                            fontSize: 12,
                          }}
                        >
                          <span style={{ color: "#f44336" }}>[[{targetName}]]</span>
                          {onCreateNote && (
                            <button
                              onClick={() => { onCreateNote(targetName); onClose(); }}
                              style={{
                                background: "var(--bg-tertiary)",
                                border: "1px solid var(--border-color)",
                                borderRadius: 3,
                                padding: "1px 6px",
                                fontSize: 10,
                                color: "var(--text-muted)",
                                cursor: "pointer",
                              }}
                            >
                              Create
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
