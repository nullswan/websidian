import { useState, useEffect, useMemo } from "react";

interface GraphData {
  nodes: Array<{ id: string; name: string; wordCount?: number }>;
  edges: Array<{ source: string; target: string }>;
}

interface VaultStatsProps {
  onClose: () => void;
  onNavigate: (path: string) => void;
}

export function VaultStats({ onClose, onNavigate }: VaultStatsProps) {
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [tags, setTags] = useState<Array<{ name: string; count: number }>>([]);

  useEffect(() => {
    fetch("/api/vault/graph", { credentials: "include" })
      .then((r) => r.json())
      .then(setGraph)
      .catch(() => {});
    fetch("/api/vault/tags", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setTags(data.tags ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const stats = useMemo(() => {
    if (!graph) return null;
    const totalNotes = graph.nodes.length;
    const totalWords = graph.nodes.reduce((s, n) => s + (n.wordCount ?? 0), 0);
    const totalEdges = graph.edges.length;

    // Backlink counts
    const backlinkMap = new Map<string, number>();
    for (const edge of graph.edges) {
      backlinkMap.set(edge.target, (backlinkMap.get(edge.target) ?? 0) + 1);
    }

    // Outgoing link counts
    const outlinkMap = new Map<string, number>();
    for (const edge of graph.edges) {
      outlinkMap.set(edge.source, (outlinkMap.get(edge.source) ?? 0) + 1);
    }

    // Most linked (by backlinks)
    const mostLinked = [...backlinkMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([path, count]) => ({
        path,
        name: path.replace(/\.md$/, "").split("/").pop() ?? path,
        count,
      }));

    // Orphan notes (no incoming or outgoing links)
    const linkedPaths = new Set([
      ...graph.edges.map((e) => e.source),
      ...graph.edges.map((e) => e.target),
    ]);
    const orphans = graph.nodes
      .filter((n) => !linkedPaths.has(n.id))
      .map((n) => ({ path: n.id, name: n.name }));

    // Largest notes by word count
    const largestNotes = [...graph.nodes]
      .filter((n) => (n.wordCount ?? 0) > 0)
      .sort((a, b) => (b.wordCount ?? 0) - (a.wordCount ?? 0))
      .slice(0, 10)
      .map((n) => ({ path: n.id, name: n.name, words: n.wordCount ?? 0 }));

    const avgWords = totalNotes > 0 ? Math.round(totalWords / totalNotes) : 0;

    return { totalNotes, totalWords, totalEdges, avgWords, mostLinked, orphans, largestNotes };
  }, [graph]);

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ width: 680, maxWidth: "90vw", maxHeight: "80vh", background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 8, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>Vault Statistics</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 18, cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
          {!stats ? (
            <div style={{ color: "var(--text-faint)", fontSize: 13 }}>Loading...</div>
          ) : (
            <>
              {/* Summary cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
                <StatCard label="Notes" value={stats.totalNotes.toLocaleString()} />
                <StatCard label="Total Words" value={stats.totalWords.toLocaleString()} />
                <StatCard label="Avg Words/Note" value={stats.avgWords.toLocaleString()} />
                <StatCard label="Links" value={stats.totalEdges.toLocaleString()} />
              </div>

              {/* Tag cloud */}
              {tags.length > 0 && (
                <Section title="Tag Cloud">
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {tags.slice(0, 30).map((tag) => {
                      const size = Math.min(Math.max(10, 10 + tag.count * 2), 20);
                      return (
                        <span
                          key={tag.name}
                          style={{
                            fontSize: size,
                            color: "var(--accent-color)",
                            opacity: 0.5 + Math.min(tag.count / 10, 0.5),
                            cursor: "default",
                          }}
                          title={`#${tag.name} (${tag.count})`}
                        >
                          #{tag.name}
                        </span>
                      );
                    })}
                  </div>
                </Section>
              )}

              {/* Most linked */}
              <Section title={`Most Linked Notes (${stats.mostLinked.length})`}>
                {stats.mostLinked.map((n) => (
                  <NoteRow key={n.path} name={n.name} detail={`${n.count} backlinks`} onClick={() => { onNavigate(n.path); onClose(); }} />
                ))}
                {stats.mostLinked.length === 0 && <EmptyMsg>No linked notes</EmptyMsg>}
              </Section>

              {/* Largest notes */}
              <Section title="Largest Notes">
                {stats.largestNotes.map((n) => (
                  <NoteRow key={n.path} name={n.name} detail={`${n.words.toLocaleString()} words`} onClick={() => { onNavigate(n.path); onClose(); }} />
                ))}
              </Section>

              {/* Orphans */}
              <Section title={`Orphan Notes (${stats.orphans.length})`}>
                {stats.orphans.slice(0, 15).map((n) => (
                  <NoteRow key={n.path} name={n.name} detail="no links" onClick={() => { onNavigate(n.path); onClose(); }} />
                ))}
                {stats.orphans.length === 0 && <EmptyMsg>No orphan notes</EmptyMsg>}
                {stats.orphans.length > 15 && <EmptyMsg>...and {stats.orphans.length - 15} more</EmptyMsg>}
              </Section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "var(--bg-tertiary)", borderRadius: 6, padding: "12px 16px", textAlign: "center" }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: "var(--accent-color)" }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{title}</div>
      {children}
    </div>
  );
}

function NoteRow({ name, detail, onClick }: { name: string; detail: string; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{ display: "flex", justifyContent: "space-between", padding: "4px 8px", cursor: "pointer", borderRadius: 3, fontSize: 13 }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
    >
      <span style={{ color: "var(--accent-color)" }}>{name}</span>
      <span style={{ color: "var(--text-faint)", fontSize: 11 }}>{detail}</span>
    </div>
  );
}

function EmptyMsg({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: "4px 8px", fontSize: 12, color: "var(--text-faint)", fontStyle: "italic" }}>{children}</div>;
}
