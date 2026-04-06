import React, { useState, useRef, useCallback, useEffect } from "react";

interface SearchResult {
  path: string;
  matches: Array<{ line: number; text: string }>;
  mtime?: string;
}

interface SearchPanelProps {
  onNavigate: (path: string, query?: string, line?: number) => void;
  initialQuery?: string;
  onClose?: () => void;
  showToast?: (msg: string) => void;
  onCreateNote?: (title: string) => void;
}

export function SearchPanel({ onNavigate, initialQuery, onClose, showToast, onCreateNote }: SearchPanelProps) {
  const [query, setQuery] = useState(initialQuery ?? "");
  const [replaceText, setReplaceText] = useState("");
  const [showReplace, setShowReplace] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [useRegex, setUseRegex] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [regexError, setRegexError] = useState<string | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const [sortMode, setSortMode] = useState<"relevance" | "modified" | "name">("relevance");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const lastInitialQuery = useRef(initialQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-focus input on mount
  useEffect(() => { inputRef.current?.focus(); }, []);

  const doSearch = useCallback(
    (q: string, regex: boolean, cs: boolean) => {
      if (!q.trim()) {
        setResults([]);
        setRegexError(null);
        return;
      }
      setSearching(true);
      setRegexError(null);
      const params = new URLSearchParams({ q });
      if (regex) params.set("regex", "true");
      if (cs) params.set("caseSensitive", "true");
      fetch(`/api/vault/search?${params}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.error) {
            setRegexError(data.error);
            setResults([]);
          } else {
            setResults(data.results ?? []);
          }
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
      setRegexError(null);
      return;
    }
    debounceRef.current = setTimeout(() => doSearch(query, useRegex, caseSensitive), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, useRegex, caseSensitive, doSearch]);

  // Handle external query changes (e.g. tag click)
  useEffect(() => {
    if (initialQuery && initialQuery !== lastInitialQuery.current) {
      lastInitialQuery.current = initialQuery;
      setQuery(initialQuery);
      doSearch(initialQuery, useRegex, caseSensitive);
    }
  }, [initialQuery, doSearch, useRegex, caseSensitive]);

  // Reset selection when results change
  useEffect(() => { setSelectedIdx(-1); setExpanded(new Set()); }, [results]);

  const sortedResults = [...results].sort((a, b) => {
    if (sortMode === "relevance") {
      const diff = b.matches.length - a.matches.length;
      return diff !== 0 ? diff : a.path.localeCompare(b.path);
    } else if (sortMode === "modified") {
      return (b.mtime ?? "").localeCompare(a.mtime ?? "");
    } else {
      return a.path.localeCompare(b.path);
    }
  });

  const totalMatches = results.reduce((sum, r) => sum + r.matches.length, 0);

  const toggleCollapse = (path: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const doReplace = async (paths?: string[]) => {
    if (!query.trim()) return;
    setReplacing(true);
    try {
      const res = await fetch("/api/vault/search-replace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          query,
          replace: replaceText,
          regex: useRegex,
          caseSensitive,
          paths,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setRegexError(data.error);
      } else {
        showToast?.(`Replaced ${data.totalReplacements} occurrence${data.totalReplacements !== 1 ? "s" : ""} in ${data.changedFiles.length} file${data.changedFiles.length !== 1 ? "s" : ""}`);
        // Re-run search to update results
        doSearch(query, useRegex, caseSensitive);
      }
    } catch {
      // ignore
    }
    setReplacing(false);
  };

  const toggleBtnStyle = (active: boolean): React.CSSProperties => ({
    background: active ? "rgba(127,109,242,0.2)" : "transparent",
    border: active ? "1px solid rgba(127,109,242,0.5)" : "1px solid var(--border-color)",
    color: active ? "var(--accent-color)" : "var(--text-faint)",
    borderRadius: 3,
    padding: "2px 5px",
    fontSize: 11,
    cursor: "pointer",
    fontWeight: active ? 600 : 400,
    lineHeight: 1,
    userSelect: "none" as const,
    transition: "all 0.15s",
  });

  const actionBtnStyle: React.CSSProperties = {
    background: "transparent",
    border: "1px solid var(--border-color)",
    borderRadius: 3,
    color: "var(--text-secondary)",
    fontSize: 10,
    padding: "2px 6px",
    cursor: "pointer",
    lineHeight: 1.4,
    flexShrink: 0,
    whiteSpace: "nowrap",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-color)" }}>
        <div style={{ display: "flex", gap: 4, alignItems: "flex-start" }}>
          <span
            onClick={() => setShowReplace((v) => !v)}
            style={{
              color: "var(--text-faint)", fontSize: 10, cursor: "pointer", userSelect: "none",
              marginTop: 8, width: 12, textAlign: "center", flexShrink: 0,
              transition: "transform 0.15s",
              transform: showReplace ? "rotate(90deg)" : "rotate(0deg)",
            }}
          >
            ▸
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ position: "relative" }}>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    onClose?.();
                    return;
                  }
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setSelectedIdx((i) => Math.min(i + 1, sortedResults.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setSelectedIdx((i) => Math.max(i - 1, -1));
                  } else if (e.key === "Enter" && selectedIdx >= 0 && sortedResults[selectedIdx]) {
                    e.preventDefault();
                    onNavigate(sortedResults[selectedIdx].path, query);
                  }
                }}
                placeholder={useRegex ? "Regex pattern..." : "Search vault..."}
                style={{
                  width: "100%",
                  padding: "6px 28px 6px 8px",
                  border: regexError ? "1px solid #f44" : "1px solid var(--border-color)",
                  borderRadius: 4,
                  background: "var(--bg-tertiary)",
                  color: "var(--text-primary)",
                  fontSize: 13,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              {query && (
                <span
                  onClick={() => { setQuery(""); setResults([]); setRegexError(null); inputRef.current?.focus(); }}
                  style={{
                    position: "absolute",
                    right: 6,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-faint)",
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
            {showReplace && (
              <div style={{ position: "relative", marginTop: 4 }}>
                <input
                  type="text"
                  value={replaceText}
                  onChange={(e) => setReplaceText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.preventDefault();
                      onClose?.();
                    } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      doReplace();
                    }
                  }}
                  placeholder="Replace..."
                  style={{
                    width: "100%",
                    padding: "6px 8px",
                    border: "1px solid var(--border-color)",
                    borderRadius: 4,
                    background: "var(--bg-tertiary)",
                    color: "var(--text-primary)",
                    fontSize: 13,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                  <button
                    onClick={() => doReplace()}
                    disabled={replacing || !query.trim()}
                    style={{
                      ...actionBtnStyle,
                      color: replacing ? "var(--text-faint)" : "var(--accent-color)",
                      border: "1px solid rgba(127,109,242,0.3)",
                    }}
                    title="Replace all (Ctrl+Enter)"
                  >
                    {replacing ? "Replacing..." : "Replace All"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, marginTop: 4, alignItems: "center", paddingLeft: 16 }}>
          <span
            title="Use regular expression"
            onClick={() => setUseRegex((v) => !v)}
            style={toggleBtnStyle(useRegex)}
          >
            .*
          </span>
          <span
            title="Match case"
            onClick={() => setCaseSensitive((v) => !v)}
            style={toggleBtnStyle(caseSensitive)}
          >
            Aa
          </span>
          {results.length > 0 && (
            <>
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as "relevance" | "modified" | "name")}
                style={{
                  marginLeft: "auto",
                  background: "var(--bg-tertiary)",
                  border: "1px solid var(--border-color)",
                  borderRadius: 3,
                  color: "var(--text-muted)",
                  fontSize: 10,
                  padding: "1px 2px",
                  cursor: "pointer",
                  outline: "none",
                }}
              >
                <option value="relevance">Relevance</option>
                <option value="modified">Modified</option>
                <option value="name">Name</option>
              </select>
              <span style={{ fontSize: 11, color: "var(--text-faint)" }}>
                {totalMatches} match{totalMatches !== 1 ? "es" : ""} in {results.length} file{results.length !== 1 ? "s" : ""}
              </span>
            </>
          )}
        </div>
        {regexError && (
          <div style={{ fontSize: 11, color: "#f44", marginTop: 2, paddingLeft: 16 }}>
            {regexError}
          </div>
        )}
      </div>
      <div style={{ flex: 1, overflow: "auto", fontSize: 13 }}>
        {searching && (
          <div style={{ padding: 12, color: "var(--text-faint)" }}>Searching...</div>
        )}
        {sortedResults.map((r, rIdx) => {
          const isCollapsed = collapsed.has(r.path);
          const isSelected = rIdx === selectedIdx;
          return (
            <div key={r.path} style={{ borderBottom: "1px solid var(--bg-tertiary)" }}>
              <div
                ref={(el) => { if (el && isSelected) el.scrollIntoView({ block: "nearest" }); }}
                style={{
                  padding: "6px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: "pointer",
                  background: isSelected ? "rgba(127,109,242,0.12)" : "transparent",
                }}
                onClick={() => toggleCollapse(r.path)}
              >
                <span style={{ color: "var(--text-faint)", fontSize: 10, width: 10, textAlign: "center", flexShrink: 0 }}>
                  {isCollapsed ? "▸" : "▾"}
                </span>
                <span
                  style={{ color: "var(--accent-color)", fontWeight: 500, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  onClick={(e) => { e.stopPropagation(); onNavigate(r.path, query); }}
                >
                  {r.path.replace(/\.md$/, "")}
                </span>
                {showReplace && (
                  <button
                    onClick={(e) => { e.stopPropagation(); doReplace([r.path]); }}
                    style={{ ...actionBtnStyle, fontSize: 9, padding: "1px 4px" }}
                    title="Replace in this file"
                  >
                    Replace
                  </button>
                )}
                <span style={{ color: "var(--text-faint)", fontSize: 11, flexShrink: 0 }}>
                  {r.matches.length}
                </span>
              </div>
              {!isCollapsed && (expanded.has(r.path) ? r.matches : r.matches.slice(0, 5)).map((m) => (
                <div
                  key={m.line}
                  style={{
                    padding: "2px 12px 2px 28px",
                    color: "var(--text-secondary)",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                  onClick={() => onNavigate(r.path, query, m.line)}
                >
                  <span style={{ color: "var(--text-faint)", marginRight: 6 }}>
                    {m.line}:
                  </span>
                  {highlightMatch(trimContext(m.text, query, caseSensitive, 80), query, useRegex, caseSensitive)}
                </div>
              ))}
              {!isCollapsed && r.matches.length > 5 && !expanded.has(r.path) && (
                <div
                  style={{
                    padding: "2px 12px 4px 28px",
                    color: "var(--accent-color)",
                    fontSize: 11,
                    cursor: "pointer",
                  }}
                  onClick={() => setExpanded((prev) => { const next = new Set(prev); next.add(r.path); return next; })}
                >
                  Show {r.matches.length - 5} more match{r.matches.length - 5 !== 1 ? "es" : ""}...
                </div>
              )}
              {!isCollapsed && expanded.has(r.path) && r.matches.length > 5 && (
                <div
                  style={{
                    padding: "2px 12px 4px 28px",
                    color: "var(--text-faint)",
                    fontSize: 11,
                    cursor: "pointer",
                  }}
                  onClick={() => setExpanded((prev) => { const next = new Set(prev); next.delete(r.path); return next; })}
                >
                  Show less
                </div>
              )}
            </div>
          );
        })}
        {!searching && results.length === 0 && query && !regexError && (
          <div style={{ padding: 12, color: "var(--text-faint)" }}>
            No results found
            {onCreateNote && query.trim() && !useRegex && (
              <button
                onClick={() => {
                  onCreateNote(query.trim());
                  onClose?.();
                }}
                style={{
                  display: "block",
                  marginTop: 8,
                  padding: "6px 12px",
                  background: "transparent",
                  border: "1px solid var(--accent-color)",
                  borderRadius: 4,
                  color: "var(--accent-color)",
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                Create note: "{query.trim()}"
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function trimContext(text: string, query: string, caseSensitive: boolean, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const searchStr = caseSensitive ? query : query.toLowerCase();
  const textToSearch = caseSensitive ? text : text.toLowerCase();
  const idx = textToSearch.indexOf(searchStr);
  if (idx === -1) return text.slice(0, maxLen) + "...";
  const pad = Math.floor((maxLen - query.length) / 2);
  const start = Math.max(0, idx - pad);
  const end = Math.min(text.length, idx + query.length + pad);
  let result = text.slice(start, end);
  if (start > 0) result = "..." + result;
  if (end < text.length) result = result + "...";
  return result;
}

function highlightMatch(text: string, query: string, isRegex: boolean, caseSensitive: boolean): React.ReactNode {
  if (!query) return <>{text}</>;
  try {
    if (isRegex) {
      const re = new RegExp(`(${query})`, caseSensitive ? "g" : "gi");
      const parts = text.split(re);
      if (parts.length <= 1) return <>{text}</>;
      return (
        <>
          {parts.map((part, i) =>
            re.test(part) ? (
              <span key={i} style={{ color: "#e6994a", fontWeight: 600 }}>{part}</span>
            ) : (
              <React.Fragment key={i}>{part}</React.Fragment>
            )
          )}
        </>
      );
    }
  } catch {
    // Fall through to plain highlight
  }
  const searchStr = caseSensitive ? query : query.toLowerCase();
  const textToSearch = caseSensitive ? text : text.toLowerCase();
  const idx = textToSearch.indexOf(searchStr);
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
