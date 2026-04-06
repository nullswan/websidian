import { useState, useEffect } from "react";

interface RelatedNote {
  path: string;
  name: string;
  score: number;
  reasons: string[];
}

interface RelatedNotesProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export function RelatedNotes({ currentPath, onNavigate }: RelatedNotesProps) {
  const [related, setRelated] = useState<RelatedNote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    // Fetch graph + note data in parallel
    Promise.all([
      fetch(`/api/vault/graph`, { credentials: "include" }).then((r) => r.json()),
      fetch(`/api/vault/note?path=${encodeURIComponent(currentPath)}`, { credentials: "include" }).then((r) => r.json()),
      fetch(`/api/vault/tags`, { credentials: "include" }).then((r) => r.json()),
    ])
      .then(([graphData, noteData, tagsData]) => {
        if (cancelled) return;

        const nodes: Array<{ id: string; path: string }> = graphData.nodes ?? [];
        const edges: Array<{ source: string; target: string }> = graphData.edges ?? [];
        const currentTags: string[] = noteData.tags ?? [];
        const allTags: Array<{ name: string; count: number }> = tagsData.tags ?? [];

        // Build adjacency: who links to whom
        const linksFrom = new Map<string, Set<string>>();
        const linksTo = new Map<string, Set<string>>();
        for (const edge of edges) {
          if (!linksFrom.has(edge.source)) linksFrom.set(edge.source, new Set());
          linksFrom.get(edge.source)!.add(edge.target);
          if (!linksTo.has(edge.target)) linksTo.set(edge.target, new Set());
          linksTo.get(edge.target)!.add(edge.source);
        }

        // Direct connections (already shown in backlinks/outgoing)
        const directLinks = new Set<string>();
        const outgoing = linksFrom.get(currentPath) ?? new Set();
        const incoming = linksTo.get(currentPath) ?? new Set();
        for (const p of outgoing) directLinks.add(p);
        for (const p of incoming) directLinks.add(p);

        // Fetch tags for all notes to find shared-tag candidates
        // We'll use a simpler approach: fetch notes that share tags via tag data
        const tagToNotes = new Map<string, string[]>();

        // We need per-note tags. We'll compute from graph + search approach.
        // Since we can't fetch all notes, use the current note's tags and
        // find other notes with those tags via search.
        const candidates = new Map<string, { score: number; reasons: string[] }>();

        // 1. Co-citation scoring: notes that are linked FROM the same sources
        for (const [source, targets] of linksFrom.entries()) {
          if (source === currentPath) continue;
          if (targets.has(currentPath)) {
            // This source links to current note AND to other notes
            for (const target of targets) {
              if (target === currentPath || directLinks.has(target)) continue;
              const existing = candidates.get(target) ?? { score: 0, reasons: [] };
              existing.score += 2;
              if (!existing.reasons.includes("co-cited")) {
                existing.reasons.push("co-cited");
              }
              candidates.set(target, existing);
            }
          }
        }

        // 2. Second-hop connections: notes linked by my direct links
        for (const neighbor of directLinks) {
          const neighborLinks = linksFrom.get(neighbor) ?? new Set();
          for (const hop2 of neighborLinks) {
            if (hop2 === currentPath || directLinks.has(hop2)) continue;
            const existing = candidates.get(hop2) ?? { score: 0, reasons: [] };
            existing.score += 1;
            if (!existing.reasons.includes("2-hop")) {
              existing.reasons.push("2-hop");
            }
            candidates.set(hop2, existing);
          }
        }

        // Now fetch tags for top candidates via individual note endpoints
        // For efficiency, just score based on graph and show results
        // We'll enhance with tag matching via a quick search if there are current tags
        if (currentTags.length > 0) {
          // Search for notes with shared tags
          const tagSearches = currentTags.slice(0, 3).map((tag) =>
            fetch(`/api/vault/search?q=${encodeURIComponent("#" + tag)}`, { credentials: "include" })
              .then((r) => r.json())
              .then((data) => ({ tag, results: data.results ?? [] }))
              .catch(() => ({ tag, results: [] }))
          );

          Promise.all(tagSearches).then((tagResults) => {
            if (cancelled) return;

            for (const { tag, results } of tagResults) {
              for (const result of results as Array<{ path: string }>) {
                if (result.path === currentPath || directLinks.has(result.path)) continue;
                const existing = candidates.get(result.path) ?? { score: 0, reasons: [] };
                existing.score += 3; // Tags are high signal
                if (!existing.reasons.includes(`#${tag}`)) {
                  existing.reasons.push(`#${tag}`);
                }
                candidates.set(result.path, existing);
              }
            }

            finalize(candidates, nodes);
          });
        } else {
          finalize(candidates, nodes);
        }

        function finalize(
          cands: Map<string, { score: number; reasons: string[] }>,
          nodeList: Array<{ id: string; path: string }>,
        ) {
          const nodeMap = new Map(nodeList.map((n) => [n.path, n]));
          const sorted = [...cands.entries()]
            .filter(([path]) => nodeMap.has(path))
            .sort((a, b) => b[1].score - a[1].score)
            .slice(0, 5)
            .map(([path, data]) => ({
              path,
              name: path.replace(/\.md$/, "").split("/").pop() || path,
              score: data.score,
              reasons: data.reasons,
            }));

          setRelated(sorted);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [currentPath]);

  if (loading) {
    return <div style={{ padding: "8px 12px", color: "var(--text-faint)", fontSize: 12 }}>Analyzing connections...</div>;
  }

  if (related.length === 0) {
    return <div style={{ padding: "8px 12px", color: "var(--text-faint)", fontSize: 12 }}>No suggestions yet</div>;
  }

  const maxScore = Math.max(...related.map((r) => r.score));

  return (
    <div style={{ padding: "4px 0" }}>
      {related.map((note) => {
        const strength = note.score / maxScore;
        return (
          <div
            key={note.path}
            onClick={() => onNavigate(note.path)}
            style={{
              padding: "5px 12px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(127,109,242,0.08)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            {/* Relevance dots */}
            <span style={{ display: "flex", gap: 2, flexShrink: 0 }}>
              {[0.2, 0.4, 0.6, 0.8, 1.0].map((threshold, i) => (
                <span
                  key={i}
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: "50%",
                    background: strength >= threshold ? "var(--accent-color)" : "var(--border-color)",
                    transition: "background 0.2s",
                  }}
                />
              ))}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 12,
                color: "var(--text-secondary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}>
                {note.name}
              </div>
              <div style={{
                fontSize: 10,
                color: "var(--text-faint)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}>
                {note.reasons.map((r) =>
                  r.startsWith("#") ? r : r === "co-cited" ? "co-cited" : "2nd degree"
                ).join(" · ")}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
