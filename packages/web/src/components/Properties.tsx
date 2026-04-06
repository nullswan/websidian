import { useState, useRef, useEffect } from "react";

interface PropertiesProps {
  frontmatter: Record<string, unknown>;
  fileCreated?: string;
  fileModified?: string;
  fileSize?: number;
  onUpdate?: (key: string, value: string) => void;
  onDelete?: (key: string) => void;
  onAdd?: (key: string, value: string) => void;
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

function InlineEdit({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);
  useEffect(() => { setDraft(value); }, [value]);

  if (!editing) {
    return (
      <span
        className="prop-value"
        style={{ cursor: "pointer", borderBottom: "1px dashed transparent" }}
        onMouseEnter={(e) => (e.currentTarget.style.borderBottomColor = "var(--text-faint)")}
        onMouseLeave={(e) => (e.currentTarget.style.borderBottomColor = "transparent")}
        onClick={() => setEditing(true)}
        title="Click to edit"
      >
        {value || "—"}
      </span>
    );
  }

  const commit = () => {
    setEditing(false);
    if (draft !== value) onCommit(draft);
  };

  return (
    <input
      ref={inputRef}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") { setDraft(value); setEditing(false); }
      }}
      style={{
        flex: 1,
        background: "var(--bg-tertiary)",
        border: "1px solid var(--accent-color)",
        borderRadius: 3,
        color: "var(--text-primary)",
        fontSize: 11,
        padding: "1px 4px",
        outline: "none",
      }}
    />
  );
}

export function Properties({ frontmatter, fileCreated, fileModified, fileSize, onUpdate, onDelete, onAdd }: PropertiesProps) {
  const entries = Object.entries(frontmatter);
  const hasFileInfo = fileCreated || fileModified || fileSize != null;
  const [adding, setAdding] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newVal, setNewVal] = useState("");
  const keyRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (adding) keyRef.current?.focus(); }, [adding]);

  if (entries.length === 0 && !hasFileInfo && !onAdd) return null;

  const commitAdd = () => {
    if (newKey.trim() && onAdd) {
      onAdd(newKey.trim(), newVal);
      setNewKey("");
      setNewVal("");
      setAdding(false);
    }
  };

  return (
    <div className="properties-panel">
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {entries.map(([key, value]) => (
          <div key={key} style={{ display: "flex", gap: 6, alignItems: "baseline", group: "true" } as React.CSSProperties}>
            <span className="prop-key" style={{ minWidth: 50, flexShrink: 0 }}>{key}</span>
            {onUpdate ? (
              <InlineEdit value={renderValue(value)} onCommit={(v) => onUpdate(key, v)} />
            ) : (
              <span className="prop-value">{renderValue(value)}</span>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(key)}
                title={`Remove ${key}`}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-faint)",
                  cursor: "pointer",
                  fontSize: 11,
                  padding: "0 2px",
                  opacity: 0.5,
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.color = "#e05252"; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.5"; e.currentTarget.style.color = "var(--text-faint)"; }}
              >
                ×
              </button>
            )}
          </div>
        ))}

        {adding && (
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <input
              ref={keyRef}
              placeholder="key"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") commitAdd(); if (e.key === "Escape") setAdding(false); }}
              style={{
                width: 60,
                background: "var(--bg-tertiary)",
                border: "1px solid var(--border-color)",
                borderRadius: 3,
                color: "var(--text-primary)",
                fontSize: 11,
                padding: "1px 4px",
                outline: "none",
              }}
            />
            <input
              placeholder="value"
              value={newVal}
              onChange={(e) => setNewVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") commitAdd(); if (e.key === "Escape") setAdding(false); }}
              style={{
                flex: 1,
                background: "var(--bg-tertiary)",
                border: "1px solid var(--border-color)",
                borderRadius: 3,
                color: "var(--text-primary)",
                fontSize: 11,
                padding: "1px 4px",
                outline: "none",
              }}
            />
            <button
              onClick={commitAdd}
              style={{
                background: "none",
                border: "none",
                color: "var(--accent-color)",
                cursor: "pointer",
                fontSize: 12,
                padding: 0,
              }}
            >
              ✓
            </button>
          </div>
        )}

        {onAdd && !adding && (
          <button
            onClick={() => setAdding(true)}
            style={{
              background: "none",
              border: "1px dashed var(--border-color)",
              borderRadius: 3,
              color: "var(--text-faint)",
              cursor: "pointer",
              fontSize: 11,
              padding: "2px 6px",
              marginTop: 2,
              textAlign: "left",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent-color)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-color)"; e.currentTarget.style.color = "var(--text-faint)"; }}
          >
            + Add property
          </button>
        )}

        {hasFileInfo && (entries.length > 0 || adding) && (
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
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
