interface PropertiesProps {
  frontmatter: Record<string, unknown>;
  fileCreated?: string;
  fileModified?: string;
  fileSize?: number;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function Properties({ frontmatter, fileCreated, fileModified, fileSize }: PropertiesProps) {
  const entries = Object.entries(frontmatter);
  const hasFileInfo = fileCreated || fileModified || fileSize != null;
  if (entries.length === 0 && !hasFileInfo) return null;

  return (
    <div className="properties-panel">
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {entries.map(([key, value]) => (
          <div key={key} style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
            <span className="prop-key">{key}</span>
            <span className="prop-value">{renderValue(value)}</span>
          </div>
        ))}
        {hasFileInfo && entries.length > 0 && (
          <div style={{ borderTop: "1px solid var(--border-color)", margin: "4px 0" }} />
        )}
        {fileCreated && (
          <div style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
            <span className="prop-key">created</span>
            <span className="prop-value">{formatDate(fileCreated)}</span>
          </div>
        )}
        {fileModified && (
          <div style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
            <span className="prop-key">modified</span>
            <span className="prop-value">{formatDate(fileModified)}</span>
          </div>
        )}
        {fileSize != null && (
          <div style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
            <span className="prop-key">size</span>
            <span className="prop-value">{formatSize(fileSize)}</span>
          </div>
        )}
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
