interface BacklinksProps {
  backlinks: Array<{ path: string; context: string; lineContext?: string }>;
  onNavigate: (path: string) => void;
}

export function Backlinks({ backlinks, onNavigate }: BacklinksProps) {
  if (backlinks.length === 0) {
    return (
      <div style={{ padding: "4px 12px", fontSize: 12, color: "#555" }}>
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

  return (
    <div style={{ padding: "4px 12px 8px" }}>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {[...grouped.entries()].map(([path, entries]) => (
          <li key={path} style={{ marginBottom: 8 }}>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                onNavigate(path);
              }}
              title={path}
              style={{
                color: "#7f6df2",
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
                  color: "#999",
                  marginTop: 2,
                  padding: "2px 0 2px 8px",
                  borderLeft: "2px solid #333",
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
    </div>
  );
}
