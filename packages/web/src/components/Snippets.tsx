import { useState, useEffect, useCallback, useRef } from "react";

interface Snippet {
  name: string;
  filename: string;
}

export function Snippets() {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [activeSnippets, setActiveSnippets] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/vault/snippets")
      .then((r) => r.json())
      .then((data) => setSnippets(data.snippets ?? []));
  }, []);

  const toggleSnippet = useCallback(
    (snippet: Snippet) => {
      const styleId = `snippet-${snippet.name}`;

      if (activeSnippets.has(snippet.name)) {
        // Remove
        const el = document.getElementById(styleId);
        if (el) el.remove();
        setActiveSnippets((prev) => {
          const next = new Set(prev);
          next.delete(snippet.name);
          return next;
        });
      } else {
        // Fetch and inject
        fetch(`/api/vault/snippet?name=${encodeURIComponent(snippet.filename)}`)
          .then((r) => r.json())
          .then((data) => {
            if (data.content) {
              const style = document.createElement("style");
              style.id = styleId;
              style.textContent = data.content;
              document.head.appendChild(style);
              setActiveSnippets((prev) => new Set(prev).add(snippet.name));
            }
          });
      }
    },
    [activeSnippets],
  );

  // Live preview: temporarily inject CSS on hover
  const previewRef = useRef<HTMLStyleElement | null>(null);
  const previewCache = useRef<Record<string, string>>({});

  const handleMouseEnter = useCallback((snippet: Snippet) => {
    if (activeSnippets.has(snippet.name)) return; // already active
    const cached = previewCache.current[snippet.filename];
    if (cached) {
      const style = document.createElement("style");
      style.id = `snippet-preview-${snippet.name}`;
      style.textContent = cached;
      document.head.appendChild(style);
      previewRef.current = style;
      return;
    }
    fetch(`/api/vault/snippet?name=${encodeURIComponent(snippet.filename)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.content) {
          previewCache.current[snippet.filename] = data.content;
          const style = document.createElement("style");
          style.id = `snippet-preview-${snippet.name}`;
          style.textContent = data.content;
          document.head.appendChild(style);
          previewRef.current = style;
        }
      });
  }, [activeSnippets]);

  const handleMouseLeave = useCallback(() => {
    if (previewRef.current) {
      previewRef.current.remove();
      previewRef.current = null;
    }
  }, []);

  if (snippets.length === 0) return null;

  return (
    <div style={{ padding: "4px 12px 8px" }}>
      {snippets.map((s) => (
        <label
          key={s.name}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "3px 0",
            fontSize: 12,
            color: "var(--text-primary)",
            cursor: "pointer",
          }}
          onMouseEnter={() => handleMouseEnter(s)}
          onMouseLeave={handleMouseLeave}
        >
          <input
            type="checkbox"
            checked={activeSnippets.has(s.name)}
            onChange={() => toggleSnippet(s)}
            style={{ accentColor: "var(--accent-color)" }}
          />
          <span style={{ flex: 1 }}>{s.name}</span>
          {!activeSnippets.has(s.name) && (
            <span style={{ fontSize: 9, color: "var(--text-faint)", opacity: 0.6 }}>hover to preview</span>
          )}
        </label>
      ))}
    </div>
  );
}
