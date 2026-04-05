import React, { useState, useRef, useCallback } from "react";

interface SearchResult {
  path: string;
  matches: Array<{ line: number; text: string }>;
}

interface SearchPanelProps {
  onNavigate: (path: string, query?: string) => void;
  initialQuery?: string;
}

export function SearchPanel({ onNavigate, initialQuery }: SearchPanelProps) {
  const [query, setQuery] = useState(initialQuery ?? "");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastInitialQuery = useRef(initialQuery);

  const doSearch = useCallback(
    (q: string) => {
      if (!q.trim()) {
        setResults([]);
        return;
      }
      setSearching(true);
      fetch(`/api/vault/search?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((data) => {
          setResults(data.results ?? []);
          setSearching(false);
        })
        .catch(() => setSearching(false));
    },
    [],
  );

  // Handle external query changes (e.g. tag click)
  React.useEffect(() => {
    if (initialQuery && initialQuery !== lastInitialQuery.current) {
      lastInitialQuery.current = initialQuery;
      setQuery(initialQuery);
      doSearch(initialQuery);
    }
  }, [initialQuery, doSearch]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      doSearch(query);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "8px 12px", borderBottom: "1px solid #333" }}>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search vault..."
          style={{
            width: "100%",
            padding: "6px 8px",
            border: "1px solid #444",
            borderRadius: 4,
            background: "#2a2a2a",
            color: "#ddd",
            fontSize: 13,
            outline: "none",
          }}
        />
      </div>
      <div style={{ flex: 1, overflow: "auto", fontSize: 13 }}>
        {searching && (
          <div style={{ padding: 12, color: "#666" }}>Searching...</div>
        )}
        {results.map((r) => (
          <div key={r.path} style={{ borderBottom: "1px solid #2a2a2a" }}>
            <div
              style={{
                padding: "6px 12px",
                color: "#7f6df2",
                cursor: "pointer",
                fontWeight: 500,
              }}
              onClick={() => onNavigate(r.path, query)}
            >
              {r.path.replace(/\.md$/, "")}
            </div>
            {r.matches.slice(0, 3).map((m) => (
              <div
                key={m.line}
                style={{
                  padding: "2px 12px 2px 24px",
                  color: "#999",
                  fontSize: 12,
                  cursor: "pointer",
                }}
                onClick={() => onNavigate(r.path, query)}
              >
                <span style={{ color: "#555", marginRight: 6 }}>
                  {m.line}:
                </span>
                {highlightMatch(m.text, query)}
              </div>
            ))}
            {r.matches.length > 3 && (
              <div
                style={{
                  padding: "2px 12px 4px 24px",
                  color: "#555",
                  fontSize: 11,
                }}
              >
                +{r.matches.length - 3} more matches
              </div>
            )}
          </div>
        ))}
        {!searching && results.length === 0 && query && (
          <div style={{ padding: 12, color: "#555" }}>No results found</div>
        )}
      </div>
    </div>
  );
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span style={{ color: "#e6994a", fontWeight: 600 }}>
        {text.slice(idx, idx + query.length)}
      </span>
      {text.slice(idx + query.length)}
    </>
  );
}
