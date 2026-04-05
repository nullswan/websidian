interface PropertiesProps {
  frontmatter: Record<string, unknown>;
}

export function Properties({ frontmatter }: PropertiesProps) {
  const entries = Object.entries(frontmatter);
  if (entries.length === 0) return null;

  return (
    <div className="properties-panel">
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {entries.map(([key, value]) => (
          <div key={key} style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
            <span className="prop-key">{key}</span>
            <span className="prop-value">{renderValue(value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(String).join(", ");
  }
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
