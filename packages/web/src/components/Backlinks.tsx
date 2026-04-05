interface BacklinksProps {
  backlinks: Array<{ path: string; context: string }>;
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

  return (
    <div style={{ padding: "4px 12px 8px" }}>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {backlinks.map((bl) => (
          <li key={bl.path} style={{ marginBottom: 4 }}>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                onNavigate(bl.path);
              }}
              style={{
                color: "#7f6df2",
                textDecoration: "none",
                fontSize: 13,
              }}
            >
              {bl.path.replace(/\.md$/, "")}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
