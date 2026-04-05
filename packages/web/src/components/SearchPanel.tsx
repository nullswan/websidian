import React, { useState, useRef, useCallback, useEffect } from "react";

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
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const lastInitialQuery = useRef(initialQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Search-as-you-type with debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => doSearch(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, doSearch]);

  // Handle external query changes (e.g. tag click)
  useEffect(() => {
    if (initialQuery && initialQuery !== lastInitialQuery.current) {
      lastInitialQuery.current = initialQuery;
      setQuery(initialQuery);
      doSearch(initialQuery);
    }
  }, [initialQuery, doSearch]);

  const totalMatches = results.reduce((sum, r) => sum + r.matches.length, 0);

  const toggleCollapse = (path: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "8px 12px", borderBottom: "1px solid #333" }}>
        <div style={{ position: "relative" }}>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search vault..."
            style={{
              width: "100%",
              padding: "6px 28px 6px 8px",
              border: "1px solid #444",
              borderRadius: 4,
              background: "#2a2a2a",
              color: "#ddd",
              fontSize: 13,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          {query && (
            <span
              onClick={() => { setQuery(""); setResults([]); inputRef.current?.focus(); }}
              style={{
                position: "absolute",
                right: 6,
                top: "50%",
                transform: "translateY(-50%)",
                color: "#666",
                cursor: "pointer",
                fontSize: 14,
                lineHeight: 1,
                userSelect: "none",
              }}
            >
              ×
            </span>
          )}
        </div>
        {results.length > 0 && (
          <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>
            {totalMatches} match{totalMatches !== 1 ? "es" : ""} in {results.length} file{results.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>
      <div style={{ flex: 1, overflow: "auto", fontSize: 13 }}>
        {searching && (
          <div style={{ padding: 12, color: "#666" }}>Searching...</div>
        )}
        {results.map((r) => {
          const isCollapsed = collapsed.has(r.path);
          return (
            <div key={r.path} style={{ borderBottom: "1px solid #2a2a2a" }}>
              <div
                style={{
                  padding: "6px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: "pointer",
                }}
                onClick={() => toggleCollapse(r.path)}
              >
                <span style={{ color: "#555", fontSize: 10, width: 10, textAlign: "center", flexShrink: 0 }}>
                  {isCollapsed ? "▸" : "▾"}
                </span>
                <span
                  style={{ color: "#7f6df2", fontWeight: 500, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  onClick={(e) => { e.stopPropagation(); onNavigate(r.path, query); }}
                >
                  {r.path.replace(/\.md$/, "")}
                </span>
                <span style={{ color: "#555", fontSize: 11, flexShrink: 0 }}>
                  {r.matches.length}
                </span>
              </div>
              {!isCollapsed && r.matches.slice(0, 5).map((m) => (
                <div
                  key={m.line}
                  style={{
                    padding: "2px 12px 2px 28px",
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
              {!isCollapsed && r.matches.length > 5 && (
                <div
                  style={{
                    padding: "2px 12px 4px 28px",
                    color: "#555",
                    fontSize: 11,
                    cursor: "pointer",
                  }}
                  onClick={() => onNavigate(r.path, query)}
                >
                  +{r.matches.length - 5} more
                </div>
              )}
            </div>
          );
        })}
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
