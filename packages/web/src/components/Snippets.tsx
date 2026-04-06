import { useState, useEffect, useCallback } from "react";

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
        >
          <input
            type="checkbox"
            checked={activeSnippets.has(s.name)}
            onChange={() => toggleSnippet(s)}
            style={{ accentColor: "var(--accent-color)" }}
          />
          {s.name}
        </label>
      ))}
    </div>
  );
}
