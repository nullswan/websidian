import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { FileTree } from "./components/FileTree.js";
import { Editor } from "./components/Editor.js";
import { Reader } from "./components/Reader.js";
import { Properties } from "./components/Properties.js";
import { Backlinks } from "./components/Backlinks.js";
import { QuickSwitcher } from "./components/QuickSwitcher.js";
import { SearchPanel } from "./components/SearchPanel.js";
import { Outline } from "./components/Outline.js";
import { CommandPalette } from "./components/CommandPalette.js";
import { WorkspaceManager } from "./components/WorkspaceManager.js";
import { ResizeHandle } from "./components/ResizeHandle.js";
import { Graph } from "./components/Graph.js";
import { CanvasView } from "./components/CanvasView.js";
import { Snippets } from "./components/Snippets.js";
import { Tags } from "./components/Tags.js";
import { LocalGraph } from "./components/LocalGraph.js";
import { LoginPage } from "./components/LoginPage.js";
import { Plugins } from "./components/Plugins.js";
import { StatusBar } from "./components/StatusBar.js";
import { Calendar } from "./components/Calendar.js";
import { VersionHistory, saveSnapshot } from "./components/VersionHistory.js";
import { Minimap } from "./components/Minimap.js";
import { VaultStats } from "./components/VaultStats.js";
import { Settings, loadSettings, type AppSettings } from "./components/Settings.js";
import { createMarkdownRenderer } from "./lib/markdown.js";
import { loadHotkeyOverrides, buildHotkeyMap, matchesCombo, getHotkey } from "./lib/hotkeys.js";
import type { VaultEntry } from "./types.js";
import "./styles.css";
import "katex/dist/katex.min.css";
import "highlight.js/styles/github-dark.css";

type ViewMode = "edit" | "read" | "source";

// --- Frontmatter helpers ---
const FM_RE = /^---[\t ]*\r?\n([\s\S]*?)\n---[\t ]*(?:\r?\n|$)/;

function updateFrontmatterField(content: string, key: string, value: string): string {
  const m = FM_RE.exec(content);
  if (!m) return content;
  const lines = m[1].split("\n");
  const keyRe = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:`);
  const idx = lines.findIndex((l) => keyRe.test(l));
  if (idx >= 0) {
    lines[idx] = `${key}: ${value}`;
  }
  return content.slice(0, m.index) + `---\n${lines.join("\n")}\n---\n` + content.slice(m.index + m[0].length);
}

function deleteFrontmatterField(content: string, key: string): string {
  const m = FM_RE.exec(content);
  if (!m) return content;
  const lines = m[1].split("\n");
  const keyRe = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:`);
  const filtered = lines.filter((l) => !keyRe.test(l));
  if (filtered.length === 0) {
    // Remove entire frontmatter block
    return content.slice(m.index + m[0].length);
  }
  return content.slice(0, m.index) + `---\n${filtered.join("\n")}\n---\n` + content.slice(m.index + m[0].length);
}

function addFrontmatterField(content: string, key: string, value: string): string {
  const m = FM_RE.exec(content);
  if (m) {
    const lines = m[1].split("\n");
    lines.push(`${key}: ${value}`);
    return content.slice(0, m.index) + `---\n${lines.join("\n")}\n---\n` + content.slice(m.index + m[0].length);
  }
  // No frontmatter yet — create one
  return `---\n${key}: ${value}\n---\n${content}`;
}

interface NoteMeta {
  frontmatter: Record<string, unknown>;
  aliases: string[];
  tags: Array<{ name: string }>;
  links: Array<{ target: string }>;
  embeds: Array<{ target: string }>;
}

interface BacklinkEntry {
  path: string;
  context: string;
  lineContext?: string;
}

interface UnlinkedMention {
  path: string;
  line: number;
  lineContext: string;
}

interface Tab {
  id: string;
  path: string;
  content: string;
  mode: ViewMode;
  noteMeta: NoteMeta | null;
  backlinks: BacklinkEntry[];
  unlinkedMentions: UnlinkedMention[];
  scrollTop: number;
  pinned?: boolean;
  missing?: boolean;
  dirty?: boolean;
  color?: string;
  fileCreated?: string;
  fileModified?: string;
  fileSize?: number;
}

interface Pane {
  tabIds: string[];
  activeTabId: string | null;
}

let tabIdCounter = 0;
function nextTabId() {
  return `tab-${++tabIdCounter}`;
}

function ScrollContainer({ tabId, scrollTop, updateTab, children, className, noteContent, showMinimap, onProgressChange, searchQuery, notePath }: {
  tabId: string | null;
  scrollTop: number;
  updateTab: (id: string, patch: Partial<Tab>) => void;
  children: React.ReactNode;
  className?: string;
  noteContent?: string;
  showMinimap?: boolean;
  onProgressChange?: (progress: number) => void;
  searchQuery?: string;
  notePath?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const lastTabId = useRef<string | null>(null);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [progress, setProgress] = useState(0);
  const [scrollMetrics, setScrollMetrics] = useState({ scrollTop: 0, scrollHeight: 1, clientHeight: 1 });

  useEffect(() => {
    const el = ref.current;
    if (!el || !tabId) return;

    // Restore scroll when tab changes
    if (tabId !== lastTabId.current) {
      lastTabId.current = tabId;
      requestAnimationFrame(() => {
        el.scrollTop = scrollTop;
        const max = el.scrollHeight - el.clientHeight;
        setProgress(max > 0 ? el.scrollTop / max : 0);
      });
    }

    const handleScroll = () => {
      const max = el.scrollHeight - el.clientHeight;
      const p = max > 0 ? el.scrollTop / max : 0;
      setProgress(p);
      onProgressChange?.(p);
      // Persist max reading progress per note
      if (notePath) {
        try {
          const key = `reading-progress:${notePath}`;
          const prev = parseFloat(localStorage.getItem(key) || "0");
          if (p > prev) localStorage.setItem(key, p.toFixed(2));
        } catch {}
      }
      setScrollMetrics({ scrollTop: el.scrollTop, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight });

      if (scrollTimer.current) clearTimeout(scrollTimer.current);
      scrollTimer.current = setTimeout(() => {
        updateTab(tabId, { scrollTop: el.scrollTop });
      }, 300);
    };

    el.addEventListener("scroll", handleScroll);
    return () => {
      el.removeEventListener("scroll", handleScroll);
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
    };
  }, [tabId, scrollTop, updateTab]);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      {tabId && (
        <div style={{ height: 2, flexShrink: 0, background: "var(--bg-tertiary)" }}>
          <div style={{
            height: "100%",
            width: `${progress * 100}%`,
            background: "var(--accent-color)",
            transition: "width 0.1s ease-out",
          }} />
        </div>
      )}
      <div style={{ flex: 1, display: "flex", minHeight: 0, position: "relative" }}>
        <div ref={ref} className={className} style={{ flex: 1, overflow: "auto" }}>
          <div key={tabId} className="note-content-fade">{children}</div>
        </div>
        {progress > 0.3 && (
          <button
            onClick={() => { if (ref.current) ref.current.scrollTo({ top: 0, behavior: "smooth" }); }}
            title="Back to top"
            style={{
              position: "absolute", bottom: 16, right: 20, zIndex: 10,
              width: 32, height: 32, borderRadius: "50%",
              background: "var(--bg-tertiary)", border: "1px solid var(--border-color)",
              color: "var(--text-secondary)", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, opacity: 0.7, transition: "opacity 0.15s",
              boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
            }}
            onMouseEnter={(e) => { (e.target as HTMLElement).style.opacity = "1"; }}
            onMouseLeave={(e) => { (e.target as HTMLElement).style.opacity = "0.7"; }}
          >
            ↑
          </button>
        )}
        {showMinimap && noteContent && (
          <Minimap
            content={noteContent}
            scrollTop={scrollMetrics.scrollTop}
            scrollHeight={scrollMetrics.scrollHeight}
            clientHeight={scrollMetrics.clientHeight}
            searchQuery={searchQuery}
            onSeek={(fraction) => {
              if (ref.current) {
                ref.current.scrollTop = fraction * (ref.current.scrollHeight - ref.current.clientHeight);
              }
            }}
          />
        )}
      </div>
    </div>
  );
}

function FolderPicker({ folders, currentPath, onSelect, onClose }: {
  folders: string[];
  currentPath: string;
  onSelect: (folder: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const currentFolder = currentPath.includes("/") ? currentPath.split("/").slice(0, -1).join("/") : "(root)";
  const filtered = query.trim()
    ? folders.filter((f) => f.toLowerCase().includes(query.toLowerCase()))
    : folders;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (filtered[selectedIdx]) onSelect(filtered[selectedIdx]); }
    else if (e.key === "Escape") { onClose(); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "15vh", zIndex: 10000 }} onClick={onClose}>
      <div style={{ width: 400, maxWidth: "90vw", background: "var(--bg-tertiary)", border: "1px solid var(--border-color)", borderRadius: 8, overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "12px 12px 8px", fontSize: 12, color: "var(--text-muted)" }}>
          Move <strong style={{ color: "var(--text-primary)" }}>{currentPath.split("/").pop()}</strong> to folder
          {currentFolder !== "(root)" && <span style={{ color: "var(--text-faint)" }}> (currently in {currentFolder})</span>}
        </div>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSelectedIdx(0); }}
          onKeyDown={handleKeyDown}
          placeholder="Search folders..."
          style={{ width: "100%", padding: "8px 12px", background: "var(--bg-primary)", border: "none", borderTop: "1px solid var(--border-color)", borderBottom: "1px solid var(--border-color)", color: "var(--text-primary)", fontSize: 14, outline: "none", boxSizing: "border-box" }}
        />
        <div style={{ maxHeight: 300, overflow: "auto" }}>
          {filtered.map((folder, i) => (
            <div
              key={folder}
              onClick={() => onSelect(folder)}
              style={{
                padding: "6px 12px",
                cursor: "pointer",
                background: i === selectedIdx ? "rgba(127,109,242,0.15)" : "transparent",
                color: folder === currentFolder ? "var(--accent-color)" : "var(--text-primary)",
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
              onMouseEnter={() => setSelectedIdx(i)}
            >
              <span style={{ color: "var(--text-faint)", fontSize: 12 }}>{folder === "(root)" ? "/" : "📁"}</span>
              <span>{folder === "(root)" ? "Vault root" : folder}</span>
              {folder === currentFolder && <span style={{ fontSize: 10, color: "var(--text-faint)", marginLeft: "auto" }}>current</span>}
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: "12px", color: "var(--text-faint)", fontSize: 13, textAlign: "center" }}>No matching folders</div>
          )}
        </div>
      </div>
    </div>
  );
}

function SidebarSection({ title, defaultOpen = true, badge, children }: {
  title: string;
  defaultOpen?: boolean;
  badge?: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(() => {
    try {
      const stored = localStorage.getItem(`sidebar-${title}`);
      return stored !== null ? stored === "1" : defaultOpen;
    } catch { return defaultOpen; }
  });

  const toggle = () => {
    const next = !open;
    setOpen(next);
    try { localStorage.setItem(`sidebar-${title}`, next ? "1" : "0"); } catch {}
  };

  return (
    <div style={{ borderTop: "1px solid var(--bg-tertiary)" }}>
      <div
        onClick={toggle}
        style={{
          padding: "6px 12px",
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          color: "var(--text-muted)",
          letterSpacing: "0.05em",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 6,
          userSelect: "none",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; }}
      >
        <svg
          width="8"
          height="8"
          viewBox="0 0 8 8"
          fill="currentColor"
          style={{
            transition: "transform 0.15s",
            transform: open ? "rotate(90deg)" : "rotate(0deg)",
            flexShrink: 0,
            opacity: 0.7,
          }}
        >
          <path d="M2 0 L6 4 L2 8 Z" />
        </svg>
        {title}
        {badge != null && badge > 0 && (
          <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--accent-color)", background: "rgba(127,109,242,0.12)", padding: "1px 5px", borderRadius: 8, fontWeight: 600 }}>{badge}</span>
        )}
      </div>
      <div style={{
        overflow: "hidden",
        maxHeight: open ? 2000 : 0,
        transition: "max-height 0.2s ease-in-out",
        opacity: open ? 1 : 0,
      }}>
        {children}
      </div>
    </div>
  );
}

function TemplatePicker({ templatesFolder, onSelect, onClose }: {
  templatesFolder: string;
  onSelect: (path: string) => void;
  onClose: () => void;
}) {
  const [templates, setTemplates] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/vault/tree", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        const paths: string[] = [];
        const walk = (entries: VaultEntry[], prefix: string) => {
          for (const e of entries) {
            if (e.kind === "folder" && e.children) {
              walk(e.children, e.path);
            } else if (e.path.startsWith(templatesFolder + "/") && e.path.endsWith(".md")) {
              paths.push(e.path);
            }
          }
        };
        walk(data.tree ?? data, "");
        setTemplates(paths);
      });
    inputRef.current?.focus();
  }, [templatesFolder]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const filtered = filter
    ? templates.filter((p) => p.toLowerCase().includes(filter.toLowerCase()))
    : templates;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "15vh",
        background: "rgba(0,0,0,0.5)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: 500,
        maxWidth: "90vw",
        background: "var(--bg-secondary)",
        border: "1px solid var(--border-color)",
        borderRadius: 8,
        overflow: "hidden",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
      }}>
        <input
          ref={inputRef}
          value={filter}
          onChange={(e) => { setFilter(e.target.value); setSelected(0); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setSelected((s) => Math.min(s + 1, filtered.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
            if (e.key === "Enter" && filtered[selected]) { onSelect(filtered[selected]); }
          }}
          placeholder="Choose a template..."
          style={{
            width: "100%",
            padding: "12px 16px",
            background: "transparent",
            border: "none",
            borderBottom: "1px solid var(--border-color)",
            color: "var(--text-primary)",
            fontSize: 15,
            outline: "none",
          }}
        />
        <div style={{ maxHeight: 300, overflow: "auto" }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 16, fontSize: 13, color: "var(--text-faint)" }}>
              {templates.length === 0
                ? `No templates found in "${templatesFolder}/" folder`
                : "No matching templates"}
            </div>
          ) : (
            filtered.map((path, i) => {
              const name = path.replace(/\.md$/, "").split("/").pop() ?? path;
              return (
                <div
                  key={path}
                  onClick={() => onSelect(path)}
                  style={{
                    padding: "8px 16px",
                    cursor: "pointer",
                    background: i === selected ? "var(--bg-hover)" : "transparent",
                    color: i === selected ? "var(--text-primary)" : "var(--text-secondary)",
                    fontSize: 14,
                  }}
                  onMouseEnter={() => setSelected(i)}
                >
                  {name}
                  <span style={{ fontSize: 11, color: "var(--text-faint)", marginLeft: 8 }}>
                    {path}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

const STOP_WORDS = new Set(["the","be","to","of","and","a","in","that","have","i","it","for","not","on","with","he","as","you","do","at","this","but","his","by","from","they","we","her","she","or","an","will","my","one","all","would","there","their","what","so","up","out","if","about","who","get","which","go","me","when","make","can","like","time","no","just","him","know","take","people","into","year","your","good","some","could","them","see","other","than","then","now","look","only","come","its","over","think","also","back","after","use","two","how","our","work","first","well","way","even","new","want","because","any","these","give","day","most","us"]);

function WordFrequency({ content }: { content: string }) {
  const words = useMemo(() => {
    const text = content.replace(/^---[\t ]*\r?\n[\s\S]*?\n---[\t ]*(?:\r?\n|$)/, "")
      .replace(/\[\[[^\]]+\]\]/g, "")
      .replace(/[#*_~`=\[\](){}|>]/g, " ")
      .toLowerCase();
    const counts: Record<string, number> = {};
    for (const w of text.split(/\s+/)) {
      const clean = w.replace(/[^a-z0-9'-]/g, "");
      if (clean.length < 3 || STOP_WORDS.has(clean)) continue;
      counts[clean] = (counts[clean] || 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [content]);

  if (words.length === 0) return <div style={{ padding: "4px 12px", fontSize: 12, color: "var(--text-faint)" }}>No significant words</div>;

  const maxCount = words[0][1];
  return (
    <div style={{ padding: "4px 8px" }}>
      {words.map(([word, count]) => (
        <div key={word} style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 4px", fontSize: 12 }}>
          <span style={{ flex: 1, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{word}</span>
          <div style={{ width: 60, height: 4, borderRadius: 2, background: "var(--bg-hover)", flexShrink: 0 }}>
            <div style={{ width: `${(count / maxCount) * 100}%`, height: "100%", borderRadius: 2, background: "var(--accent-color)", opacity: 0.6 }} />
          </div>
          <span style={{ fontSize: 10, color: "var(--text-faint)", width: 20, textAlign: "right", flexShrink: 0 }}>{count}</span>
        </div>
      ))}
    </div>
  );
}

function OutgoingLinks({ content, onNavigate, tree }: { content: string; onNavigate: (path: string) => void; tree: VaultEntry[] }) {
  // Collect all file basenames (without .md) and full paths for resolution
  const resolvedNames = useMemo(() => {
    const names = new Set<string>();
    const walk = (entries: VaultEntry[]) => {
      for (const e of entries) {
        if (e.kind === "file") {
          names.add(e.path);
          // Also add basename without extension for short-link matching
          const base = e.path.replace(/\.[^.]+$/, "").split("/").pop()?.toLowerCase();
          if (base) names.add(base);
          // And full path without extension
          names.add(e.path.replace(/\.[^.]+$/, "").toLowerCase());
        } else if (e.kind === "folder") {
          walk(e.children);
        }
      }
    };
    walk(tree);
    return names;
  }, [tree]);

  const links = useMemo(() => {
    const re = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g;
    const seen = new Set<string>();
    const result: Array<{ target: string; resolved: boolean }> = [];
    let m;
    while ((m = re.exec(content)) !== null) {
      const target = m[1].trim();
      if (!seen.has(target)) {
        seen.add(target);
        const t = target.toLowerCase();
        const resolved = resolvedNames.has(t) || resolvedNames.has(t + ".md") || resolvedNames.has(target);
        result.push({ target, resolved });
      }
    }
    return result;
  }, [content, resolvedNames]);

  if (links.length === 0) {
    return (
      <div style={{ padding: "4px 12px", fontSize: 12, color: "var(--text-faint)" }}>
        No outgoing links
      </div>
    );
  }

  const resolved = links.filter((l) => l.resolved);
  const unresolved = links.filter((l) => !l.resolved);

  return (
    <div style={{ padding: "4px 12px 8px" }}>
      {resolved.length > 0 && (
        <>
          <div style={{ fontSize: 11, color: "var(--text-faint)", marginBottom: 4 }}>
            {resolved.length} resolved
          </div>
          <ul style={{ listStyle: "none", padding: 0, margin: "0 0 8px" }}>
            {resolved.map(({ target }) => {
              const display = target.replace(/\.md$/, "").split("/").pop() ?? target;
              return (
                <li key={target} style={{ marginBottom: 4 }}>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate(target);
                    }}
                    style={{
                      color: "var(--accent-color)",
                      textDecoration: "none",
                      fontSize: 13,
                    }}
                  >
                    {display}
                  </a>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {unresolved.length > 0 && (
        <>
          <div style={{ fontSize: 11, color: "var(--text-faint)", marginBottom: 4 }}>
            {unresolved.length} unresolved
          </div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {unresolved.map(({ target }) => {
              const display = target.replace(/\.md$/, "").split("/").pop() ?? target;
              return (
                <li key={target} style={{ marginBottom: 4 }}>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate(target);
                    }}
                    style={{
                      color: "var(--text-faint)",
                      textDecoration: "none",
                      fontSize: 13,
                      opacity: 0.7,
                    }}
                  >
                    {display}
                  </a>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
/** Convert "Ctrl+X" to platform-appropriate display ("⌘X" on Mac, "Ctrl+X" elsewhere) */
function kbd(shortcut: string): string {
  if (!isMac) return shortcut;
  return shortcut
    .replace(/Ctrl\+Shift\+/g, "⌃⇧")
    .replace(/Ctrl\+Alt\+/g, "⌃⌥")
    .replace(/Ctrl\+/g, "⌘")
    .replace(/Alt\+/g, "⌥")
    .replace(/Shift\+/g, "⇧");
}

function SharePage({ shareId }: { shareId: string }) {
  const [note, setNote] = useState<{ name: string; content: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const md = useMemo(() => createMarkdownRenderer(), []);

  useEffect(() => {
    fetch(`/share/${shareId}`)
      .then((r) => { if (!r.ok) throw new Error("Not found"); return r.json(); })
      .then((data) => setNote(data))
      .catch(() => setError("Shared note not found"));
  }, [shareId]);

  if (error) return <div style={{ padding: 48, color: "#f88", fontSize: 18 }}>{error}</div>;
  if (!note) return <div style={{ padding: 48, color: "var(--text-faint)" }}>Loading...</div>;

  const fmMatch = /^---[\t ]*\r?\n[\s\S]*?\n---[\t ]*(?:\r?\n|$)/.exec(note.content);
  const body = fmMatch ? note.content.slice(fmMatch[0].length) : note.content;
  const html = md.render(body);

  return (
    <div style={{ maxWidth: 750, margin: "0 auto", padding: "32px 48px" }}>
      <h1 style={{ fontSize: "2em", marginBottom: 8, color: "var(--heading-color)" }}>{note.name}</h1>
      <div style={{ fontSize: 12, color: "var(--text-faint)", marginBottom: 24 }}>Shared from Websidian</div>
      <div className="reader-view" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

export function App() {
  // Detect share route
  const [shareId] = useState(() => {
    const hash = window.location.hash;
    if (hash.startsWith("#/share/")) return hash.slice("#/share/".length);
    return null;
  });

  if (shareId) return <SharePage shareId={shareId} />;

  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState<string | null>(null);
  const [tree, setTree] = useState<VaultEntry[]>([]);
  const [backlinkCounts, setBacklinkCounts] = useState<Record<string, number>>({});
  const [todoCounts, setTodoCounts] = useState<Record<string, number>>({});
  const [tabsMap, setTabsMap] = useState<Record<string, Tab>>({});
  const [panes, setPanes] = useState<Pane[]>([{ tabIds: [], activeTabId: null }]);
  const [activePaneIdx, setActivePaneIdx] = useState(0);
  const [vaultName, setVaultName] = useState("Vault");
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saveStatusTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [leftPanel, setLeftPanel] = useState<"files" | "search" | "plugins" | "starred" | "recent" | "trash">("files");
  const [trashFiles, setTrashFiles] = useState<{ path: string; deletedAt: string }[]>([]);
  const [recentFiles, setRecentFiles] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("recent-files") ?? "[]"); } catch { return []; }
  });
  const [starredNotes, setStarredNotes] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("obsidian-web-starred");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const toggleStar = useCallback((path: string) => {
    setStarredNotes((prev) => {
      const next = prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path];
      localStorage.setItem("obsidian-web-starred", JSON.stringify(next));
      return next;
    });
  }, []);
  const [searchQuery, setSearchQuery] = useState("");
  const [readerHighlight, setReaderHighlight] = useState("");
  const [scrollToLine, setScrollToLine] = useState<number | null>(null);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [leftWidth, setLeftWidth] = useState(260);
  const [rightWidth, setRightWidth] = useState(240);
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [showGraph, setShowGraph] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showWorkspaces, setShowWorkspaces] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showMergePicker, setShowMergePicker] = useState(false);
  const [showVaultStats, setShowVaultStats] = useState(false);
  const calendarAnchorRef = useRef<HTMLButtonElement>(null);
  const [appSettings, setAppSettings] = useState<AppSettings>(loadSettings);
  const hotkeyMapRef = useRef(buildHotkeyMap(loadHotkeyOverrides()));
  // Refresh hotkey map when settings close (user may have changed hotkeys)
  const refreshHotkeyMap = useCallback(() => {
    hotkeyMapRef.current = buildHotkeyMap(loadHotkeyOverrides());
  }, []);
  // Apply theme to document root
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", appSettings.theme);
  }, [appSettings.theme]);
  useEffect(() => {
    document.documentElement.classList.toggle("heading-numbers-enabled", appSettings.headingNumbers);
  }, [appSettings.headingNumbers]);

  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  const [leftCollapsed, setLeftCollapsed] = useState(() => window.innerWidth < 768);
  const [rightCollapsed, setRightCollapsed] = useState(() => window.innerWidth < 768);
  const [zenMode, setZenMode] = useState(false);
  const zenPrevState = useRef<{ left: boolean; right: boolean } | null>(null);
  const closedTabsStack = useRef<string[]>([]); // stack of file paths for undo close tab
  const [tabCtxMenu, setTabCtxMenu] = useState<{ x: number; y: number; tabId: string; paneIdx: number } | null>(null);
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [cursorPos, setCursorPos] = useState<{ line: number; col: number; selectedChars: number; selectedWords?: number; cursors?: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toggleZenMode = useCallback(() => {
    setZenMode((prev) => {
      if (!prev) {
        zenPrevState.current = { left: leftCollapsed, right: rightCollapsed };
        setLeftCollapsed(true);
        setRightCollapsed(true);
      } else {
        if (zenPrevState.current) {
          setLeftCollapsed(zenPrevState.current.left);
          setRightCollapsed(zenPrevState.current.right);
          zenPrevState.current = null;
        }
      }
      return !prev;
    });
  }, [leftCollapsed, rightCollapsed]);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2000);
  }, []);
  const splitDivRef = useRef<HTMLDivElement>(null);
  const dragTabRef = useRef<{ tabId: string; paneIdx: number } | null>(null);
  const [splitDropZone, setSplitDropZone] = useState(false);
  const scrollToHeadingRef = useRef<((heading: string, level: number) => void) | null>(null);
  const foldAllRef = useRef<{ foldAll: () => void; unfoldAll: () => void } | null>(null);
  const [pendingHeading, setPendingHeading] = useState<string | null>(null);

  // Set CSS accent color variable
  useEffect(() => {
    document.documentElement.style.setProperty("--accent-color", appSettings.accentColor);
  }, [appSettings.accentColor]);

  // Set CSS font family variable
  useEffect(() => {
    const families: Record<string, string> = {
      system: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
      "sans-serif": "'Inter', 'Helvetica Neue', Arial, sans-serif",
      serif: "Georgia, 'Times New Roman', Times, serif",
      monospace: "'SF Mono', 'Fira Code', 'JetBrains Mono', Menlo, monospace",
    };
    document.documentElement.style.setProperty("--font-family", families[appSettings.fontFamily] ?? families.system);
  }, [appSettings.fontFamily]);

  const activePane = panes[activePaneIdx];
  const activeTab = activePane?.activeTabId ? tabsMap[activePane.activeTabId] ?? null : null;
  const workspaceRestored = useRef(false);

  // Global navigation history (Alt+Left / Alt+Right)
  const navHistory = useRef<string[]>([]);
  const navIdx = useRef(-1);
  const navIgnore = useRef(false);

  // Persist workspace to localStorage (debounced)
  useEffect(() => {
    if (!workspaceRestored.current) return;
    const tabEntries = Object.values(tabsMap).map((t) => ({
      id: t.id,
      path: t.path,
      mode: t.mode,
    }));
    const snapshot = {
      tabs: tabEntries,
      panes: panes.map((p) => ({ tabIds: p.tabIds, activeTabId: p.activeTabId })),
      activePaneIdx,
      leftPanel,
      leftWidth,
      rightWidth,
      splitRatio,
      leftCollapsed,
      rightCollapsed,
    };
    const timeout = setTimeout(() => {
      try {
        localStorage.setItem("obsidian-web-workspace", JSON.stringify(snapshot));
      } catch {}
    }, 500);
    return () => clearTimeout(timeout);
  }, [tabsMap, panes, activePaneIdx, leftPanel, leftWidth, rightWidth, splitRatio, leftCollapsed, rightCollapsed]);

  // Check auth on mount
  useEffect(() => {
    // First check if auth is even enabled
    fetch("/api/health")
      .then((r) => r.json())
      .then((health) => {
        if (health.authEnabled === false) {
          setUser("anonymous");
          setAuthChecked(true);
          return;
        }
        // Auth is enabled, check session
        return fetch("/api/auth/me", { credentials: "include" })
          .then((r) => r.json())
          .then((data) => {
            if (data.authenticated) {
              setUser(data.username);
            }
            setAuthChecked(true);
          });
      })
      .catch(() => setAuthChecked(true));
  }, []);

  // Load vault tree when authenticated, then restore workspace
  useEffect(() => {
    if (!user) return;
    fetch("/api/vault/tree", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setTree(data.tree);
        // Fetch backlink counts for file tree badges
        fetch("/api/vault/graph", { credentials: "include" })
          .then((r) => r.json())
          .then((graphData) => {
            const counts: Record<string, number> = {};
            for (const edge of (graphData.edges ?? [])) {
              counts[edge.target] = (counts[edge.target] ?? 0) + 1;
            }
            setBacklinkCounts(counts);
          })
          .catch(() => {});
        // Fetch TODO counts for file tree badges
        fetch(`/api/vault/search?q=${encodeURIComponent("- [ ]")}`, { credentials: "include" })
          .then((r) => r.json())
          .then((searchData) => {
            const tc: Record<string, number> = {};
            for (const result of (searchData.results ?? [])) {
              tc[result.path] = (tc[result.path] ?? 0) + (result.matches?.length ?? 1);
            }
            setTodoCounts(tc);
          })
          .catch(() => {});
        // Restore workspace from localStorage after tree is loaded
        if (!workspaceRestored.current) {
          workspaceRestored.current = true;
          try {
            const raw = localStorage.getItem("obsidian-web-workspace");
            if (raw) {
              const snap = JSON.parse(raw);
              if (snap.leftPanel) setLeftPanel(snap.leftPanel);
              if (snap.leftWidth) setLeftWidth(snap.leftWidth);
              if (snap.rightWidth) setRightWidth(snap.rightWidth);
              if (snap.splitRatio) setSplitRatio(snap.splitRatio);
              if (snap.leftCollapsed) setLeftCollapsed(snap.leftCollapsed);
              if (snap.rightCollapsed) setRightCollapsed(snap.rightCollapsed);

              // Rebuild tabs and panes
              if (snap.tabs?.length > 0) {
                const newTabsMap: Record<string, Tab> = {};
                for (const t of snap.tabs) {
                  const tab: Tab = {
                    id: t.id,
                    path: t.path,
                    content: "",
                    mode: t.mode ?? "read",
                    noteMeta: null,
                    backlinks: [],
                    unlinkedMentions: [],
                    scrollTop: 0,
                  };
                  newTabsMap[t.id] = tab;

                  // Update tabIdCounter to avoid collisions
                  const num = parseInt(t.id.replace("tab-", ""), 10);
                  if (num > tabIdCounter) tabIdCounter = num;

                  // Fetch content for each tab
                  const tabId = t.id;
                  const tabPath = t.path;
                  fetch(`/api/vault/file?path=${encodeURIComponent(tabPath)}`, { credentials: "include" })
                    .then((r) => r.json())
                    .then((d) => {
                      if (d.error) {
                        updateTab(tabId, { missing: true });
                      } else {
                        updateTab(tabId, { content: d.content, missing: false, fileCreated: d.created, fileModified: d.modified, fileSize: d.size });
                      }
                    })
                    .catch(() => {});

                  if (tabPath.endsWith(".md")) {
                    fetch(`/api/vault/note?path=${encodeURIComponent(tabPath)}`, { credentials: "include" })
                      .then((r) => r.json())
                      .then((d) => { if (!d.error) updateTab(tabId, { noteMeta: d }); })
                      .catch(() => {});
                    fetch(`/api/vault/backlinks?path=${encodeURIComponent(tabPath)}`, { credentials: "include" })
                      .then((r) => r.json())
                      .then((d) => { if (!d.error) updateTab(tabId, { backlinks: d.backlinks, unlinkedMentions: d.unlinkedMentions ?? [] }); })
                      .catch(() => {});
                  }
                }
                setTabsMap(newTabsMap);

                if (snap.panes?.length > 0) {
                  setPanes(snap.panes);
                  setActivePaneIdx(snap.activePaneIdx ?? 0);
                }
              }
            }
          } catch {
            // Corrupted localStorage — ignore
          }
        }
      })
      .catch((e) => setError("Failed to load vault: " + e.message));

    fetch("/api/vault/config", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setVaultName(data.name));
  }, [user]);

  // Refresh file tree from server
  const refreshTree = useCallback(() => {
    fetch("/api/vault/tree", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setTree(data.tree))
      .catch(() => {});
  }, []);

  const refreshTrash = useCallback(() => {
    fetch("/api/vault/trash", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setTrashFiles(data.files ?? []))
      .catch(() => {});
  }, []);

  // Helper: update a specific tab in the map
  const updateTab = useCallback((id: string, patch: Partial<Tab>) => {
    setTabsMap((prev) => {
      const existing = prev[id];
      if (!existing) return prev;
      return { ...prev, [id]: { ...existing, ...patch } };
    });
  }, []);

  // Handle file rename: update tab paths and re-fetch content for affected files
  const handleFileRenamed = useCallback((from: string, to: string, updatedFiles: string[]) => {
    // Update the renamed file's tab path
    setTabsMap((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const [id, tab] of Object.entries(next)) {
        if (tab.path === from) {
          next[id] = { ...tab, path: to };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    // Re-fetch content for tabs whose links were updated
    if (updatedFiles.length > 0) {
      setTabsMap((prev) => {
        for (const filePath of updatedFiles) {
          const entry = Object.entries(prev).find(([, t]) => t.path === filePath);
          if (entry) {
            const [tabId] = entry;
            fetch(`/api/vault/file?path=${encodeURIComponent(filePath)}`, { credentials: "include" })
              .then((r) => r.json())
              .then((data) => {
                if (!data.error) updateTab(tabId, { content: data.content, fileModified: data.modified });
              });
          }
        }
        return prev;
      });
    }
  }, [updateTab]);

  // Open a file in the active pane
  const openTab = useCallback(
    (path: string, targetPaneIdx?: number) => {
      setReaderHighlight("");
      // Track recent files
      setRecentFiles((prev) => {
        const next = [path, ...prev.filter((p) => p !== path)].slice(0, 20);
        localStorage.setItem("recent-files", JSON.stringify(next));
        return next;
      });
      const pIdx = targetPaneIdx ?? activePaneIdx;

      setPanes((prev) => {
        const pane = prev[pIdx];
        // Check if already open in this pane
        const existingTabId = pane.tabIds.find((tid) => tabsMap[tid]?.path === path);
        if (existingTabId) {
          const next = [...prev];
          next[pIdx] = { ...pane, activeTabId: existingTabId };
          return next;
        }

        const id = nextTabId();
        const newTab: Tab = {
          id,
          path,
          content: "",
          mode: "read",
          noteMeta: null,
          backlinks: [],
          unlinkedMentions: [],
          scrollTop: 0,
        };

        setTabsMap((prev) => ({ ...prev, [id]: newTab }));

        // Load content
        fetch(`/api/vault/file?path=${encodeURIComponent(path)}`)
          .then((r) => r.json())
          .then((data) => {
            if (data.error) {
              updateTab(id, { missing: true });
            } else {
              updateTab(id, { content: data.content, missing: false, fileCreated: data.created, fileModified: data.modified, fileSize: data.size });
              setError(null);
            }
          })
          .catch((e) => setError("Failed to load file: " + e.message));

        if (path.endsWith(".md")) {
          fetch(`/api/vault/note?path=${encodeURIComponent(path)}`)
            .then((r) => r.json())
            .then((data) => {
              if (!data.error) updateTab(id, { noteMeta: data });
            });

          fetch(`/api/vault/backlinks?path=${encodeURIComponent(path)}`)
            .then((r) => r.json())
            .then((data) => {
              if (!data.error) updateTab(id, { backlinks: data.backlinks, unlinkedMentions: data.unlinkedMentions ?? [] });
            });
        }

        const next = [...prev];
        next[pIdx] = {
          ...pane,
          tabIds: [...pane.tabIds, id],
          activeTabId: id,
        };
        return next;
      });

      setActivePaneIdx(pIdx);
    },
    [activePaneIdx, tabsMap, updateTab],
  );

  // Close a tab in a specific pane
  const closeTab = useCallback(
    (tabId: string, paneIdx: number) => {
      // Confirm if tab has unsaved changes
      const tab = tabsMap[tabId];
      if (tab?.dirty) {
        const action = window.confirm(`"${tab.path.replace(/\.md$/, "").split("/").pop()}" has unsaved changes.\n\nDiscard changes?`);
        if (!action) return;
      }
      setPanes((prev) => {
        const pane = prev[paneIdx];
        const idx = pane.tabIds.indexOf(tabId);
        const newTabIds = pane.tabIds.filter((t) => t !== tabId);

        let newActiveTabId = pane.activeTabId;
        if (tabId === pane.activeTabId) {
          if (newTabIds.length > 0) {
            const newIdx = Math.min(idx, newTabIds.length - 1);
            newActiveTabId = newTabIds[newIdx];
          } else {
            newActiveTabId = null;
          }
        }

        const next = [...prev];
        next[paneIdx] = { tabIds: newTabIds, activeTabId: newActiveTabId };

        // If a split pane becomes empty, remove it
        if (next.length > 1 && newTabIds.length === 0) {
          next.splice(paneIdx, 1);
          setActivePaneIdx(0);
        }

        return next;
      });

      setTabsMap((prev) => {
        const tab = prev[tabId];
        if (tab?.path) {
          closedTabsStack.current.push(tab.path);
          if (closedTabsStack.current.length > 20) closedTabsStack.current.shift();
        }
        const next = { ...prev };
        delete next[tabId];
        return next;
      });
    },
    [],
  );

  // Navigate via wikilink
  const handleNavigate = useCallback(
    (target: string) => {
      const from = activeTab?.path ?? "";
      // Extract heading fragment if present
      const hashIdx = target.indexOf("#");
      const headingFragment = hashIdx !== -1 ? target.slice(hashIdx + 1).replace(/\^.*$/, "") : null;
      fetch(
        `/api/vault/resolve?target=${encodeURIComponent(target)}&from=${encodeURIComponent(from)}`,
      )
        .then((r) => r.json())
        .then((data) => {
          if (data.resolved) {
            openTab(data.resolved);
            if (headingFragment) {
              setPendingHeading(headingFragment);
            }
          } else {
            // Create note from dead link
            const newPath = target.endsWith(".md") ? target : target + ".md";
            const noteTitle = target.replace(/\.md$/, "").split("/").pop();
            const noteContent = `# ${noteTitle}\n\n`;
            fetch("/api/vault/file", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ path: newPath, content: noteContent }),
            })
              .then((r) => r.json())
              .then((res) => {
                if (res.error) {
                  setError(`Failed to create: ${newPath}`);
                } else {
                  refreshTree();
                  openTab(newPath);
                }
              })
              .catch(() => setError(`Failed to create: ${newPath}`));
          }
        })
        .catch((e) => setError("Failed to resolve link: " + e.message));
    },
    [activeTab?.path, openTab],
  );

  // Save file content for active tab
  const handleSave = useCallback(
    (content: string) => {
      if (!activeTab) return;
      setSaveStatus("saving");
      if (saveStatusTimer.current) clearTimeout(saveStatusTimer.current);
      fetch("/api/vault/file", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: activeTab.path, content }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.error) {
            setError(data.error);
            setSaveStatus("idle");
          } else {
            setError(null);
            updateTab(activeTab.id, { content, dirty: false });
            setSaveStatus("saved");
            saveStatusTimer.current = setTimeout(() => setSaveStatus("idle"), 2000);
            // Save version snapshot
            saveSnapshot(activeTab.path, content);
          }
        })
        .catch((e) => {
          setError("Failed to save: " + e.message);
          setSaveStatus("idle");
        });
    },
    [activeTab, updateTab],
  );

  // Toggle mode for active tab
  const toggleMode = useCallback(() => {
    if (!activeTab) return;
    const nextMode = activeTab.mode === "read" ? "edit" : activeTab.mode === "edit" ? "source" : "read";
    updateTab(activeTab.id, { mode: nextMode });
  }, [activeTab, updateTab]);

  // Split right: open a new pane with the current tab's file
  const splitRight = useCallback(() => {
    if (!activeTab) return;
    if (panes.length >= 2) return; // max 2 panes for now
    setPanes((prev) => [...prev, { tabIds: [], activeTabId: null }]);
    // Open the same file in the new pane after state updates
    setTimeout(() => openTab(activeTab.path, panes.length), 0);
  }, [activeTab, panes.length, openTab]);

  // Close split: merge back to single pane
  const closeSplit = useCallback(() => {
    if (panes.length <= 1) return;
    setPanes((prev) => {
      // Keep pane 0, move all tabs from pane 1 into pane 0
      const merged: Pane = {
        tabIds: [...prev[0].tabIds],
        activeTabId: prev[0].activeTabId,
      };
      // Add tabs from other panes that aren't duplicates
      for (let i = 1; i < prev.length; i++) {
        for (const tid of prev[i].tabIds) {
          if (!merged.tabIds.includes(tid)) {
            merged.tabIds.push(tid);
          } else {
            // Remove duplicate tab from map
            setTabsMap((m) => {
              const next = { ...m };
              delete next[tid];
              return next;
            });
          }
        }
      }
      return [merged];
    });
    setActivePaneIdx(0);
  }, [panes.length]);

  // Create a new untitled note
  const createNewNote = useCallback(() => {
    // Find a unique name
    const existingPaths = new Set(Object.values(tabsMap).map((t) => t.path));
    let name = "Untitled.md";
    let i = 1;
    while (existingPaths.has(name)) {
      name = `Untitled ${i}.md`;
      i++;
    }
    fetch("/api/vault/file", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ path: name, content: "" }),
    })
      .then(() => {
        refreshTree();
        openTab(name);
        showToast(`Created ${name}`);
        // Switch to edit mode for the new note and focus inline title
        setTimeout(() => {
          setTabsMap((prev) => {
            const entry = Object.entries(prev).find(([, t]) => t.path === name);
            if (!entry) return prev;
            return { ...prev, [entry[0]]: { ...entry[1], mode: "edit" } };
          });
          // Focus and select-all in inline title for immediate renaming
          setTimeout(() => {
            const titleEl = document.querySelector(".pane-active .inline-title") as HTMLElement | null;
            if (titleEl) {
              titleEl.focus();
              const range = document.createRange();
              range.selectNodeContents(titleEl);
              const sel = window.getSelection();
              sel?.removeAllRanges();
              sel?.addRange(range);
            }
          }, 150);
        }, 100);
      })
      .catch((e) => setError("Failed to create note: " + e.message));
  }, [tabsMap, refreshTree, openTab, showToast]);

  // Open or create today's daily note
  const openRandomNote = useCallback(() => {
    const collectPaths = (entries: VaultEntry[]): string[] => {
      const paths: string[] = [];
      for (const e of entries) {
        if (e.kind === "file" && e.path.endsWith(".md")) paths.push(e.path);
        else if (e.kind === "folder") paths.push(...collectPaths(e.children));
      }
      return paths;
    };
    const allPaths = collectPaths(tree);
    if (allPaths.length === 0) return;
    const randomPath = allPaths[Math.floor(Math.random() * allPaths.length)];
    openTab(randomPath);
    showToast(`Random: ${randomPath.replace(/\.md$/, "").split("/").pop()}`);
  }, [tree, openTab, showToast]);

  const duplicateNote = useCallback(async (path: string) => {
    // Fetch original content
    const res = await fetch(`/api/vault/file?path=${encodeURIComponent(path)}`, { credentials: "include" });
    if (!res.ok) return;
    const data = await res.json();
    const content = data.content ?? "";
    const base = path.replace(/\.md$/, "");
    const ext = path.endsWith(".md") ? ".md" : "";
    let copyPath = `${base} copy${ext}`;
    let n = 2;
    while (n <= 20) {
      const check = await fetch(`/api/vault/file?path=${encodeURIComponent(copyPath)}`, { credentials: "include" });
      if (check.status === 404) break;
      copyPath = `${base} copy ${n}${ext}`;
      n++;
    }
    await fetch("/api/vault/file", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ path: copyPath, content }),
    });
    refreshTree();
    openTab(copyPath);
    showToast(`Duplicated to ${copyPath.split("/").pop()}`);
  }, [refreshTree, openTab, showToast]);

  const exportAsHtml = useCallback(() => {
    if (!activeTab?.content) {
      showToast("No active note to export");
      return;
    }
    const md = createMarkdownRenderer();
    const rendered = md.render(activeTab.content);
    const title = activeTab.path.replace(/\.md$/, "").split("/").pop() || "Untitled";
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
body { margin: 0; padding: 40px; background: #1e1e1e; color: #dcddde; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; line-height: 1.65; font-size: 16px; max-width: 750px; margin: 0 auto; padding: 40px 48px; }
h1 { font-size: 2em; font-weight: 700; color: #e0e0e0; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 6px; }
h2 { font-size: 1.5em; font-weight: 600; color: #e0e0e0; }
h3 { font-size: 1.25em; font-weight: 600; color: #e0e0e0; }
a { color: #7f6df2; text-decoration: none; }
a:hover { text-decoration: underline; }
code { font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace; background: #2a2a2a; padding: 2px 5px; border-radius: 3px; font-size: 13px; }
pre { background: #2a2a2a; padding: 12px 16px; border-radius: 6px; overflow-x: auto; }
pre code { background: none; padding: 0; }
blockquote { border-left: 3px solid var(--accent-color); margin: 8px 0; padding: 4px 16px; color: #aaa; }
table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 14px; }
th, td { border: 1px solid var(--border-color); padding: 6px 12px; text-align: left; }
th { background: #2a2a2a; font-weight: 600; color: #e0e0e0; }
hr { border: none; border-top: 1px solid var(--border-color); margin: 24px 0; }
img { max-width: 100%; border-radius: 6px; }
mark { background: rgba(255, 208, 0, 0.25); color: inherit; padding: 1px 2px; border-radius: 2px; }
s { color: #888; }
.tag { color: #e6994a; background: rgba(230, 153, 74, 0.1); padding: 1px 4px; border-radius: 3px; font-size: 13px; }
</style>
</head>
<body>
<h1>${title}</h1>
${rendered}
</body>
</html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title}.html`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${title}.html`);
  }, [activeTab, showToast]);

  const mergeNoteInto = useCallback(async (sourcePath: string) => {
    if (!activeTab) return;
    try {
      // Fetch source content
      const res = await fetch(`/api/vault/file?path=${encodeURIComponent(sourcePath)}`, { credentials: "include" });
      const data = await res.json();
      if (data.error) { showToast("Failed to fetch source note"); return; }
      const sourceContent = data.content.replace(/^---[\t ]*\r?\n[\s\S]*?\n---[\t ]*(?:\r?\n|$)/, "").trim();
      const sourceName = sourcePath.replace(/\.md$/, "").split("/").pop() ?? sourcePath;
      // Append to current note
      const merged = activeTab.content + `\n\n---\n\n## Merged from ${sourceName}\n\n${sourceContent}`;
      updateTab(activeTab.id, { content: merged, dirty: true });
      handleSave(merged);
      // Update links pointing to source → point to current
      const targetName = activeTab.path.replace(/\.md$/, "").split("/").pop() ?? activeTab.path;
      await fetch("/api/vault/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ from: sourcePath, to: sourcePath + ".merged" }),
      });
      // Delete source
      await fetch("/api/vault/file", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ path: sourcePath + ".merged" }),
      });
      refreshTree();
      // Close tabs for the deleted file
      const tabToClose = Object.values(tabsMap).find((t) => t.path === sourcePath);
      if (tabToClose) closeTab(tabToClose.id, activePaneIdx);
      showToast(`Merged "${sourceName}" into current note`);
    } catch (e) {
      showToast("Merge failed: " + (e as Error).message);
    }
  }, [activeTab, updateTab, handleSave, refreshTree, tabsMap, closeTab, activePaneIdx, showToast]);

  const openDailyByDate = useCallback((dateStr: string) => {
    const path = `Daily Notes/${dateStr}.md`;
    fetch(`/api/vault/file?path=${encodeURIComponent(path)}`, { credentials: "include" })
      .then((r) => {
        if (r.ok) {
          openTab(path);
        } else {
          const [y, m, d] = dateStr.split("-");
          const dt = new Date(Number(y), Number(m) - 1, Number(d));
          const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
          const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
          const content = `---\ntags: daily\ncreated: ${dateStr}\n---\n\n# ${monthNames[dt.getMonth()]} ${dt.getDate()}, ${y} — ${dayNames[dt.getDay()]}\n\n## Tasks\n\n- [ ] \n\n## Notes\n\n`;
          fetch("/api/vault/file", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ path, content }),
          }).then(() => {
            refreshTree();
            openTab(path);
          });
        }
      })
      .catch((e) => setError("Failed to open daily note: " + e.message));
  }, [openTab, refreshTree]);

  const openDailyNote = useCallback(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    openDailyByDate(`${yyyy}-${mm}-${dd}`);
  }, [openDailyByDate]);

  // Global keyboard shortcuts (driven by customizable hotkey map)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Escape is always hardcoded (not remappable)
      if (e.key === "Escape") {
        if (showShortcuts) { setShowShortcuts(false); e.preventDefault(); return; }
        if (zenMode) { toggleZenMode(); e.preventDefault(); return; }
      }

      // Ctrl+1-9: switch to Nth tab (9 = last tab), like browsers
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key >= "1" && e.key <= "9") {
        const tabIds = activePane?.tabIds ?? [];
        if (tabIds.length === 0) return;
        const idx = e.key === "9" ? tabIds.length - 1 : Math.min(parseInt(e.key) - 1, tabIds.length - 1);
        e.preventDefault();
        setPanes((prev) => {
          const next = [...prev];
          next[activePaneIdx] = { ...prev[activePaneIdx], activeTabId: tabIds[idx] };
          return next;
        });
        return;
      }

      // Ctrl+P: print current view
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key === "p") {
        e.preventDefault();
        window.print();
        return;
      }

      // Check each registered hotkey action
      const hkMap = hotkeyMapRef.current;
      let matchedAction: string | null = null;
      for (const [combo, actionId] of hkMap) {
        if (matchesCombo(e, combo)) { matchedAction = actionId; break; }
      }
      if (!matchedAction) return;

      // Special: daily note should not intercept in editor (Cmd+D = select next occurrence)
      if (matchedAction === "daily-note" && document.activeElement?.closest(".cm-editor")) return;

      e.preventDefault();
      switch (matchedAction) {
        case "new-note": createNewNote(); break;
        case "daily-note": openDailyNote(); break;
        case "quick-switcher": setShowSwitcher(true); break;
        case "search": setLeftPanel((p) => (p === "search" ? "files" : "search")); break;
        case "toggle-mode": toggleMode(); break;
        case "command-palette": setShowCommandPalette(true); break;
        case "graph-view": setShowGraph((g) => !g); break;
        case "close-tab":
          if (activePane?.activeTabId) closeTab(activePane.activeTabId, activePaneIdx);
          break;
        case "shortcuts-help": setShowShortcuts((s) => !s); break;
        case "toggle-left-sidebar": setLeftCollapsed((c) => !c); break;
        case "toggle-right-sidebar": setRightCollapsed((c) => !c); break;
        case "zen-mode": toggleZenMode(); break;
        case "settings": setShowSettings((s) => !s); break;
        case "undo-close-tab": {
          const path = closedTabsStack.current.pop();
          if (path) openTab(path);
          break;
        }
        case "next-tab": case "prev-tab": {
          const tabIds = activePane?.tabIds ?? [];
          if (tabIds.length <= 1) return;
          const currentIdx = activePane?.activeTabId ? tabIds.indexOf(activePane.activeTabId) : 0;
          const delta = matchedAction === "prev-tab" ? -1 : 1;
          const nextIdx = (currentIdx + delta + tabIds.length) % tabIds.length;
          setPanes((prev) => {
            const next = [...prev];
            next[activePaneIdx] = { ...prev[activePaneIdx], activeTabId: tabIds[nextIdx] };
            return next;
          });
          break;
        }
        case "navigate-back":
          if (navIdx.current > 0) {
            navIdx.current--;
            navIgnore.current = true;
            openTab(navHistory.current[navIdx.current]);
          }
          break;
        case "navigate-forward":
          if (navIdx.current < navHistory.current.length - 1) {
            navIdx.current++;
            navIgnore.current = true;
            openTab(navHistory.current[navIdx.current]);
          }
          break;
        case "split-right": splitRight(); break;
        case "close-split": closeSplit(); break;
        case "focus-pane-1": setActivePaneIdx(0); break;
        case "focus-pane-2": if (panes.length > 1) setActivePaneIdx(1); break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleMode, activePane, activePaneIdx, closeTab, createNewNote, openDailyNote, openTab, showShortcuts, toggleZenMode, zenMode, splitRight, closeSplit, panes.length]);

  // Warn before closing browser with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      const hasDirty = Object.values(tabsMap).some((t) => t.dirty);
      if (hasDirty) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [tabsMap]);

  // Sync document title with active note
  useEffect(() => {
    const name = activeTab?.path.replace(/\.md$/, "").split("/").pop();
    document.title = name ? `${name} - ${vaultName || "Obsidian Web"}` : "Obsidian Web";
  }, [activeTab?.path, vaultName]);

  // Track navigation history for Alt+Left/Right
  useEffect(() => {
    if (!activeTab?.path) return;
    if (navIgnore.current) { navIgnore.current = false; return; }
    const h = navHistory.current;
    // Don't push if same as current position
    if (h[navIdx.current] === activeTab.path) return;
    // Truncate forward history
    navHistory.current = h.slice(0, navIdx.current + 1);
    navHistory.current.push(activeTab.path);
    if (navHistory.current.length > 50) navHistory.current.shift();
    navIdx.current = navHistory.current.length - 1;
  }, [activeTab?.path]);

  // Sync URL hash with active tab for deep linking
  useEffect(() => {
    if (!activeTab) return;
    const hash = `#/note/${encodeURIComponent(activeTab.path)}`;
    if (window.location.hash !== hash) {
      window.history.replaceState(null, "", hash);
    }
  }, [activeTab?.path]);

  // Handle initial hash and browser back/forward navigation
  useEffect(() => {
    const openFromHash = () => {
      // Support ?file= query parameter (obsidian:// URI scheme compat)
      const params = new URLSearchParams(window.location.search);
      const fileParam = params.get("file");
      if (fileParam && fileParam !== activeTab?.path) {
        openTab(fileParam.endsWith(".md") ? fileParam : fileParam + ".md");
        return;
      }
      const hash = window.location.hash;
      if (!hash.startsWith("#/note/")) return;
      const path = decodeURIComponent(hash.slice("#/note/".length));
      if (path && path !== activeTab?.path) {
        openTab(path);
      }
    };

    // Open note from initial URL hash (after workspace restore)
    if (workspaceRestored.current) {
      const timer = setTimeout(openFromHash, 100);
      window.addEventListener("popstate", openFromHash);
      return () => {
        clearTimeout(timer);
        window.removeEventListener("popstate", openFromHash);
      };
    }
  }, [openTab, activeTab?.path]);

  const handleLeftResize = useCallback((delta: number) => {
    setLeftWidth((w) => Math.max(140, Math.min(500, w + delta)));
  }, []);

  const handleRightResize = useCallback((delta: number) => {
    setRightWidth((w) => Math.max(140, Math.min(500, w + delta)));
  }, []);

  // Split divider drag
  const handleSplitDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const container = (e.target as HTMLElement).parentElement;
    if (!container) return;

    const handleMove = (ev: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const ratio = (ev.clientX - rect.left) / rect.width;
      setSplitRatio(Math.max(0.2, Math.min(0.8, ratio)));
    };

    const handleUp = () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const isMarkdown = activeTab?.path.endsWith(".md");
  const isSplit = panes.length > 1;

  // Show login if auth required
  if (!authChecked) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "var(--bg-primary)", color: "var(--text-faint)" }}>
        Loading...
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLogin={setUser} />;
  }

  // Render a single pane's content area
  const renderPaneContent = (pane: Pane, paneIdx: number) => {
    const paneTab = pane.activeTabId ? tabsMap[pane.activeTabId] ?? null : null;
    const paneIsMarkdown = paneTab?.path.endsWith(".md");
    const paneIsCanvas = paneTab?.path.endsWith(".canvas");
    const paneIsPdf = paneTab?.path.endsWith(".pdf");
    const paneIsImage = /\.(png|jpe?g|gif|svg|webp|bmp|avif|ico)$/i.test(paneTab?.path ?? "");
    const paneIsAudio = /\.(mp3|wav|ogg|m4a|flac|aac|webm)$/i.test(paneTab?.path ?? "");
    const paneIsVideo = /\.(mp4|webm|ogv|mov)$/i.test(paneTab?.path ?? "");
    const isActive = paneIdx === activePaneIdx;

    return (
      <div
        key={paneIdx}
        className={`pane ${isActive ? "pane-active" : ""}`}
        style={{
          flex: isSplit ? (paneIdx === 0 ? splitRatio : 1 - splitRatio) : 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          outline: isSplit && isActive ? "1px solid var(--accent-color)" : "none",
          outlineOffset: "-1px",
          position: "relative",
        }}
        onClick={() => setActivePaneIdx(paneIdx)}
        onDragOver={(e) => {
          if (!dragTabRef.current || panes.length >= 2) return;
          e.preventDefault();
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          setSplitDropZone(x > rect.width - 80);
        }}
        onDragLeave={() => setSplitDropZone(false)}
        onDrop={(e) => {
          if (!splitDropZone || !dragTabRef.current || panes.length >= 2) return;
          e.preventDefault();
          e.stopPropagation();
          const src = dragTabRef.current;
          const srcTab = tabsMap[src.tabId];
          if (!srcTab) return;
          // Create new pane with this tab
          setPanes((prev) => {
            const srcPane = { ...prev[src.paneIdx], tabIds: [...prev[src.paneIdx].tabIds] };
            const srcIdx = srcPane.tabIds.indexOf(src.tabId);
            if (srcIdx !== -1) {
              srcPane.tabIds.splice(srcIdx, 1);
              if (srcPane.activeTabId === src.tabId) {
                srcPane.activeTabId = srcPane.tabIds[Math.min(srcIdx, srcPane.tabIds.length - 1)] ?? null;
              }
            }
            return [srcPane, { tabIds: [src.tabId], activeTabId: src.tabId }];
          });
          setActivePaneIdx(1);
          dragTabRef.current = null;
          setSplitDropZone(false);
        }}
      >
        {/* Pane tab bar */}
        {!zenMode && pane.tabIds.length > 0 && (
          <div
            className="tab-bar-wrapper"
            ref={(el) => {
              if (!el) return;
              const tabBar = el.querySelector<HTMLElement>(".tab-bar");
              if (!tabBar) return;
              const check = () => el.classList.toggle("has-overflow", tabBar.scrollWidth > tabBar.clientWidth + 2);
              requestAnimationFrame(check);
              const ro = new ResizeObserver(check);
              ro.observe(tabBar);
            }}
          >
          <button className="tab-bar-scroll-btn left" onClick={(e) => {
            const bar = (e.currentTarget as HTMLElement).parentElement?.querySelector(".tab-bar");
            if (bar) bar.scrollBy({ left: -120, behavior: "smooth" });
          }}>‹</button>
          <div
            className="tab-bar"
            style={isMobile ? { paddingLeft: 0 } : undefined}
            onDoubleClick={(e) => {
              if (e.target === e.currentTarget) createNewNote();
            }}
            onWheel={(e) => {
              e.currentTarget.scrollLeft += e.deltaY;
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
            onDrop={(e) => {
              e.preventDefault();
              const src = dragTabRef.current;
              if (!src || src.paneIdx === paneIdx) return;
              // Cross-pane: append to end of this pane
              setPanes((prev) => {
                const next = prev.map((p) => ({ ...p, tabIds: [...p.tabIds] }));
                const srcPane = next[src.paneIdx];
                const dstPane = next[paneIdx];
                const srcIdx = srcPane.tabIds.indexOf(src.tabId);
                if (srcIdx === -1) return prev;
                if (dstPane.tabIds.includes(src.tabId)) return prev;
                srcPane.tabIds.splice(srcIdx, 1);
                if (srcPane.activeTabId === src.tabId) {
                  srcPane.activeTabId = srcPane.tabIds[Math.min(srcIdx, srcPane.tabIds.length - 1)] ?? null;
                }
                dstPane.tabIds.push(src.tabId);
                dstPane.activeTabId = src.tabId;
                return next;
              });
              setActivePaneIdx(paneIdx);
              dragTabRef.current = null;
            }}
          >
            {isMobile && (
              <button
                onClick={(e) => { e.stopPropagation(); setLeftCollapsed((c) => !c); }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-muted)",
                  fontSize: 16,
                  cursor: "pointer",
                  padding: "4px 8px",
                  flexShrink: 0,
                  lineHeight: 1,
                }}
                title="Toggle sidebar"
              >
                ☰
              </button>
            )}
            {[...pane.tabIds].sort((a, b) => {
              const ap = tabsMap[a]?.pinned ? 0 : 1;
              const bp = tabsMap[b]?.pinned ? 0 : 1;
              return ap - bp;
            }).map((tid) => {
              const tab = tabsMap[tid];
              if (!tab) return null;
              return (
                <div
                  key={tab.id}
                  data-tab-id={tab.id}
                  ref={(el) => {
                    if (el && tab.id === pane.activeTabId) {
                      el.scrollIntoView({ block: "nearest", inline: "nearest" });
                    }
                  }}
                  className={`tab ${tab.id === pane.activeTabId ? "active" : ""}${tab.pinned ? " pinned" : ""}`}
                  style={tab.color ? { borderTop: `2px solid ${tab.color}`, paddingTop: 4 } : undefined}
                  draggable
                  onDragStart={(e) => {
                    dragTabRef.current = { tabId: tab.id, paneIdx };
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const src = dragTabRef.current;
                    if (!src || src.tabId === tab.id) return;
                    if (src.paneIdx === paneIdx) {
                      // Within-pane reorder
                      setPanes((prev) => {
                        const next = [...prev];
                        const p = { ...next[paneIdx] };
                        const ids = [...p.tabIds];
                        const fromIdx = ids.indexOf(src.tabId);
                        const toIdx = ids.indexOf(tab.id);
                        if (fromIdx === -1 || toIdx === -1) return prev;
                        ids.splice(fromIdx, 1);
                        ids.splice(toIdx, 0, src.tabId);
                        p.tabIds = ids;
                        next[paneIdx] = p;
                        return next;
                      });
                    } else {
                      // Cross-pane move
                      setPanes((prev) => {
                        const next = prev.map((p) => ({ ...p, tabIds: [...p.tabIds] }));
                        const srcPane = next[src.paneIdx];
                        const dstPane = next[paneIdx];
                        // Remove from source pane
                        const srcIdx = srcPane.tabIds.indexOf(src.tabId);
                        if (srcIdx === -1) return prev;
                        srcPane.tabIds.splice(srcIdx, 1);
                        if (srcPane.activeTabId === src.tabId) {
                          srcPane.activeTabId = srcPane.tabIds[Math.min(srcIdx, srcPane.tabIds.length - 1)] ?? null;
                        }
                        // Insert into target pane at drop position
                        const toIdx = dstPane.tabIds.indexOf(tab.id);
                        dstPane.tabIds.splice(toIdx >= 0 ? toIdx : dstPane.tabIds.length, 0, src.tabId);
                        dstPane.activeTabId = src.tabId;
                        return next;
                      });
                      setActivePaneIdx(paneIdx);
                    }
                    dragTabRef.current = null;
                  }}
                  onDragEnd={() => { dragTabRef.current = null; }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPanes((prev) => {
                      const next = [...prev];
                      next[paneIdx] = { ...pane, activeTabId: tab.id };
                      return next;
                    });
                    setActivePaneIdx(paneIdx);
                  }}
                  onAuxClick={(e) => {
                    if (e.button === 1 && !tab.pinned) {
                      e.preventDefault();
                      closeTab(tab.id, paneIdx);
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setTabCtxMenu({ x: e.clientX, y: e.clientY, tabId: tab.id, paneIdx });
                  }}
                >
                  {tab.pinned ? (
                    <span className="tab-name" title={tab.path.split("/").pop()?.replace(/\.md$/, "") ?? tab.path} style={{ maxWidth: 28, overflow: "hidden", textOverflow: "clip" }}>
                      {(tab.path.split("/").pop()?.replace(/\.md$/, "") ?? "?").slice(0, 2)}
                    </span>
                  ) : renamingTabId === tab.id ? (
                    <input
                      className="tab-name"
                      autoFocus
                      defaultValue={tab.path.split("/").pop()?.replace(/\.md$/, "") ?? ""}
                      style={{ background: "transparent", border: "1px solid var(--accent-color)", color: "var(--text-primary)", fontSize: 13, padding: "0 4px", borderRadius: 3, outline: "none", width: 120 }}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        if (e.key === "Escape") setRenamingTabId(null);
                      }}
                      onBlur={(e) => {
                        const newName = e.target.value.trim();
                        setRenamingTabId(null);
                        if (!newName) return;
                        const oldPath = tab.path;
                        const parts = oldPath.split("/");
                        const ext = oldPath.endsWith(".md") ? ".md" : "";
                        parts[parts.length - 1] = newName + ext;
                        const newPath = parts.join("/");
                        if (newPath === oldPath) return;
                        fetch("/api/vault/rename", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          credentials: "include",
                          body: JSON.stringify({ from: oldPath, to: newPath }),
                        }).then(() => {
                          updateTab(tab.id, { path: newPath });
                          refreshTree();
                          showToast(`Renamed to ${newName}${ext}`);
                        }).catch(() => {});
                      }}
                    />
                  ) : (
                    <>
                      <span
                        className="tab-name"
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setRenamingTabId(tab.id);
                        }}
                      >
                        {tab.dirty && <span style={{ color: "var(--accent-color)", marginRight: 2 }}>●</span>}
                        {tab.path.split("/").pop()?.replace(/\.md$/, "") ?? tab.path}
                        {(() => {
                          if (!tab.content) return null;
                          const fmMatch = tab.content.match(/^---[\t ]*\r?\n([\s\S]*?)\n---/);
                          if (!fmMatch) return null;
                          const goalMatch = fmMatch[1].match(/wordGoal:\s*(\d+)/i);
                          if (!goalMatch) return null;
                          const goal = parseInt(goalMatch[1], 10);
                          if (goal <= 0) return null;
                          const body = tab.content.replace(/^---[\t ]*\r?\n[\s\S]*?\n---[\t ]*(?:\r?\n|$)/, "");
                          const words = body.trim().split(/\s+/).filter(Boolean).length;
                          const pct = Math.min(words / goal, 1);
                          const r = 5; const circ = 2 * Math.PI * r;
                          const color = pct >= 1 ? "#4caf50" : "var(--accent-color)";
                          return (
                            <span title={`${words}/${goal} words (${Math.round(pct * 100)}%)`} style={{ display: "inline-flex", marginLeft: 3, flexShrink: 0 }}>
                              <svg width="14" height="14" viewBox="0 0 14 14" style={{ transform: "rotate(-90deg)" }}>
                                <circle cx="7" cy="7" r={r} fill="none" stroke="var(--border-color)" strokeWidth="1.5" />
                                <circle cx="7" cy="7" r={r} fill="none" stroke={color} strokeWidth="1.5"
                                  strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
                                  strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.3s" }} />
                              </svg>
                            </span>
                          );
                        })()}
                        {tab.backlinks.length > 0 && (
                          <span title={`${tab.backlinks.length} backlink${tab.backlinks.length !== 1 ? "s" : ""}`} style={{
                            display: "inline-flex",
                            alignItems: "center",
                            marginLeft: 3,
                            fontSize: 9,
                            color: "var(--text-faint)",
                            background: "rgba(255,255,255,0.06)",
                            borderRadius: 6,
                            padding: "0 4px",
                            lineHeight: "14px",
                            flexShrink: 0,
                          }}>
                            {tab.backlinks.length}
                          </span>
                        )}
                      </span>
                      <button
                        className="tab-close"
                        onClick={(e) => {
                          e.stopPropagation();
                          closeTab(tab.id, paneIdx);
                        }}
                      >
                        ×
                      </button>
                    </>
                  )}
                </div>
              );
            })}
            <button
              className="tab-bar-new"
              title={`New note (${kbd("Ctrl+N")})`}
              onClick={createNewNote}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                padding: "2px 6px",
                fontSize: 18,
                lineHeight: 1,
                flexShrink: 0,
                borderRadius: 4,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
            >
              +
            </button>
            {paneTab && paneIsMarkdown && (
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", paddingRight: 8 }}>
                <button
                  className="mode-toggle-btn"
                  title={paneTab.mode === "read" ? `Switch to Live Preview (${kbd("Ctrl+E")})` : paneTab.mode === "edit" ? `Switch to Source mode (${kbd("Ctrl+E")})` : `Switch to Reading view (${kbd("Ctrl+E")})`}
                  onClick={() => {
                    const next = paneTab.mode === "read" ? "edit" : paneTab.mode === "edit" ? "source" : "read";
                    updateTab(paneTab.id, { mode: next as ViewMode });
                  }}
                >
                  {paneTab.mode === "read" ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                    </svg>
                  ) : paneTab.mode === "edit" ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                      <path d="m15 5 4 4" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="16 18 22 12 16 6" />
                      <polyline points="8 6 2 12 8 18" />
                    </svg>
                  )}
                </button>
              </div>
            )}
          </div>
          <button className="tab-bar-scroll-btn right" onClick={(e) => {
            const bar = (e.currentTarget as HTMLElement).parentElement?.querySelector(".tab-bar");
            if (bar) bar.scrollBy({ left: 120, behavior: "smooth" });
          }} title={`${pane.tabIds.length} tabs`}>
            ›
            <span className="tab-count-badge">{pane.tabIds.length}</span>
          </button>
          </div>
        )}

        {/* Breadcrumb */}
        {paneTab && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              padding: "3px 12px",
              fontSize: 11,
              color: "var(--text-faint)",
              borderBottom: "1px solid var(--bg-tertiary)",
              flexShrink: 0,
              userSelect: "none",
              overflow: "hidden",
            }}
          >
            {(() => {
              const segments = paneTab.path.replace(/\.md$/, "").split("/");
              return segments.map((seg, i) => {
                const isLast = i === segments.length - 1;
                return (
                  <React.Fragment key={i}>
                    {i > 0 && <span style={{ color: "var(--border-color)", margin: "0 2px" }}>›</span>}
                    <span
                      style={{
                        color: isLast ? "var(--text-secondary)" : "var(--text-faint)",
                        cursor: isLast ? "default" : "pointer",
                        whiteSpace: "nowrap",
                      }}
                      onMouseEnter={(e) => { if (!isLast) (e.target as HTMLElement).style.color = "var(--text-secondary)"; }}
                      onMouseLeave={(e) => { if (!isLast) (e.target as HTMLElement).style.color = "var(--text-faint)"; }}
                      onClick={() => {
                        if (!isLast) {
                          // Switch to files panel — the folder path helps user orient
                          setLeftPanel("files");
                        }
                      }}
                    >
                      {seg}
                    </span>
                  </React.Fragment>
                );
              });
            })()}
          </div>
        )}

        {/* Pane content */}
        <ScrollContainer tabId={paneTab?.id ?? null} scrollTop={paneTab?.scrollTop ?? 0} updateTab={updateTab} className={!appSettings.readableLineLength ? "wide-mode" : undefined} noteContent={paneTab?.content} showMinimap={paneIsMarkdown && (paneTab?.content?.length ?? 0) > 1000} onProgressChange={paneIdx === activePaneIdx ? setScrollProgress : undefined} searchQuery={paneIdx === activePaneIdx ? readerHighlight : undefined} notePath={paneTab?.path}>
          {/* Inline title — matches Obsidian's "Show inline title" setting */}
          {paneTab && paneIsMarkdown && appSettings.showInlineTitle && (
            <div
              className="inline-title"
              contentEditable
              suppressContentEditableWarning
              spellCheck={false}
              onBlur={(e) => {
                const newName = (e.currentTarget.textContent ?? "").trim();
                if (!newName) return;
                const oldPath = paneTab.path;
                const parts = oldPath.split("/");
                const ext = oldPath.endsWith(".md") ? ".md" : "";
                const oldName = (parts[parts.length - 1] ?? "").replace(/\.md$/, "");
                if (newName === oldName) return;
                parts[parts.length - 1] = newName + ext;
                const newPath = parts.join("/");
                fetch("/api/vault/rename", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({ from: oldPath, to: newPath }),
                }).then(() => {
                  updateTab(paneTab.id, { path: newPath });
                  refreshTree();
                  showToast(`Renamed to ${newName}${ext}`);
                }).catch(() => {});
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  (e.target as HTMLElement).blur();
                }
              }}
            >
              {paneTab.path.split("/").pop()?.replace(/\.md$/, "") ?? paneTab.path}
            </div>
          )}
          {paneTab && paneIsMarkdown && paneTab.mode === "read" && (paneTab.fileCreated || paneTab.fileModified) && (
            <div style={{ padding: "0 40px 8px", fontSize: 11, color: "var(--text-faint)", display: "flex", gap: 12 }}>
              {paneTab.fileCreated && <span>Created {new Date(paneTab.fileCreated).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</span>}
              {paneTab.fileModified && <span>Modified {new Date(paneTab.fileModified).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</span>}
            </div>
          )}
          {paneTab?.missing ? (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              height: "100%", gap: 16, color: "var(--text-muted)", userSelect: "none",
            }}>
              <div style={{ fontSize: 16, color: "var(--text-faint)" }}>File not found</div>
              <div style={{ fontSize: 13, color: "var(--text-faint)" }}>{paneTab.path}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={async () => {
                    await fetch("/api/vault/file", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      credentials: "include",
                      body: JSON.stringify({ path: paneTab.path, content: "" }),
                    });
                    updateTab(paneTab.id, { content: "", missing: false });
                    refreshTree();
                  }}
                  style={{
                    padding: "6px 14px", border: "1px solid var(--border-color)", borderRadius: 4,
                    background: "var(--bg-tertiary)", color: "var(--text-primary)", cursor: "pointer", fontSize: 12,
                  }}
                >
                  Create file
                </button>
                <button
                  onClick={() => closeTab(paneTab.id, paneIdx)}
                  style={{
                    padding: "6px 14px", border: "1px solid var(--border-color)", borderRadius: 4,
                    background: "var(--bg-tertiary)", color: "var(--text-secondary)", cursor: "pointer", fontSize: 12,
                  }}
                >
                  Close tab
                </button>
              </div>
            </div>
          ) : paneTab ? (
            paneIsCanvas ? (
              <CanvasView
                content={paneTab.content}
                onNavigate={(path) => {
                  openTab(path);
                }}
              />
            ) : paneIsPdf ? (
              <iframe
                src={`/api/vault/raw?path=${encodeURIComponent(paneTab.path)}`}
                style={{ width: "100%", height: "100%", border: "none", background: "var(--bg-secondary)" }}
                title={paneTab.path.split("/").pop() ?? "PDF"}
              />
            ) : paneIsImage ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", padding: 20, background: "var(--bg-primary)" }}>
                <img
                  src={`/api/vault/raw?path=${encodeURIComponent(paneTab.path)}`}
                  alt={paneTab.path.split("/").pop() ?? ""}
                  style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 4 }}
                />
              </div>
            ) : paneIsAudio ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 16, background: "var(--bg-primary)" }}>
                <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>{paneTab.path.split("/").pop()}</div>
                <audio
                  controls
                  src={`/api/vault/raw?path=${encodeURIComponent(paneTab.path)}`}
                  style={{ width: "min(400px, 80%)" }}
                />
              </div>
            ) : paneIsVideo ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", padding: 20, background: "var(--bg-primary)" }}>
                <video
                  controls
                  src={`/api/vault/raw?path=${encodeURIComponent(paneTab.path)}`}
                  style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 4 }}
                />
              </div>
            ) : paneIsMarkdown && paneTab.mode === "read" ? (
              <Reader
                key={paneTab.path}
                content={paneTab.content}
                filePath={paneTab.path}
                onNavigate={handleNavigate}
                onSave={handleSave}
                searchHighlight={paneIdx === activePaneIdx ? readerHighlight : ""}
                scrollToLine={paneIdx === activePaneIdx && paneTab.id === activePane?.activeTabId ? scrollToLine : null}
                onScrollToLineDone={() => setScrollToLine(null)}
                scrollToHeading={paneIdx === activePaneIdx && paneTab.id === activePane?.activeTabId ? pendingHeading : null}
                onScrollToHeadingDone={() => setPendingHeading(null)}
                onTagClick={(tag) => {
                  setSearchQuery(`#${tag}`);
                  setLeftPanel("search");
                }}
              />
            ) : (
              <Editor
                content={paneTab.content}
                filePath={paneTab.path}
                onSave={handleSave}
                onNavigate={handleNavigate}
                onTagClick={(tag) => {
                  setSearchQuery(`#${tag}`);
                  setLeftPanel("search");
                }}
                onCursorChange={(info) => setCursorPos(info)}
                onDirty={() => { if (paneTab && !paneTab.dirty) updateTab(paneTab.id, { dirty: true }); }}
                onExtractSelection={(selectedText, replaceWith) => {
                  const name = window.prompt("New note name:");
                  if (!name?.trim()) return;
                  const newPath = name.trim().endsWith(".md") ? name.trim() : `${name.trim()}.md`;
                  fetch("/api/vault/file", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ path: newPath, content: selectedText }),
                  }).then((res) => {
                    if (res.ok) {
                      const linkName = newPath.replace(/\.md$/, "");
                      replaceWith(`[[${linkName}]]`);
                      refreshTree();
                      showToast(`Extracted to ${linkName}`);
                    }
                  });
                }}
                fontSize={appSettings.editorFontSize}
                spellCheck={appSettings.spellCheck}
                showLineNumbers={appSettings.showLineNumbers}
                tabSize={appSettings.tabSize}
                typewriterMode={appSettings.typewriterMode}
                focusMode={appSettings.focusMode}
                vimMode={appSettings.vimMode}
                lineWrap={appSettings.lineWrap}
                showWhitespace={appSettings.showWhitespace}
                cursorBlinkRate={appSettings.cursorBlinkRate}
                sourceMode={paneTab.mode === "source"}
                scrollToHeadingRef={scrollToHeadingRef}
                foldAllRef={foldAllRef}
              />
            )
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                gap: 24,
                userSelect: "none",
              }}
            >
              <div style={{ fontSize: 28, fontWeight: 300, color: "var(--text-faint)", letterSpacing: "-0.5px" }}>
                {vaultName}
              </div>
              {tree.length > 0 && (() => {
                const count = (entries: VaultEntry[]): number => entries.reduce((n, e) =>
                  n + (e.kind === "file" && e.extension === "md" ? 1 : 0) + (e.kind === "folder" ? count(e.children) : 0), 0);
                const notes = count(tree);
                return (
                  <div style={{ fontSize: 12, color: "var(--border-color)", marginTop: -8 }}>
                    {notes} note{notes !== 1 ? "s" : ""}
                  </div>
                );
              })()}
              <div style={{ display: "flex", gap: 12 }}>
                {[
                  { label: "New Note", shortcut: "Ctrl+N", action: createNewNote },
                  { label: "Quick Switcher", shortcut: "Ctrl+O", action: () => setShowSwitcher(true) },
                  { label: "Daily Note", shortcut: "Ctrl+D", action: openDailyNote },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={item.action}
                    style={{
                      padding: "8px 16px",
                      border: "1px solid var(--border-color)",
                      borderRadius: 6,
                      background: "var(--bg-tertiary)",
                      color: "var(--text-secondary)",
                      cursor: "pointer",
                      fontSize: 12,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 4,
                      minWidth: 110,
                    }}
                    onMouseEnter={(e) => {
                      (e.target as HTMLElement).style.borderColor = "var(--accent-color)";
                      (e.target as HTMLElement).style.color = "var(--text-primary)";
                    }}
                    onMouseLeave={(e) => {
                      (e.target as HTMLElement).style.borderColor = "var(--border-color)";
                      (e.target as HTMLElement).style.color = "var(--text-secondary)";
                    }}
                  >
                    <span>{item.label}</span>
                    <span style={{ fontSize: 10, color: "var(--text-faint)" }}>{kbd(item.shortcut)}</span>
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: "var(--border-color)" }}>
                {kbd("Ctrl+/")} for all shortcuts
              </div>
            </div>
          )}
        </ScrollContainer>
        {/* Split drop zone indicator */}
        {splitDropZone && panes.length < 2 && (
          <div
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              bottom: 0,
              width: 80,
              background: "rgba(127,109,242,0.12)",
              borderLeft: "2px solid var(--accent-color)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
              zIndex: 100,
            }}
          >
            <span style={{ color: "var(--accent-color)", fontSize: 11, fontWeight: 600, writingMode: "vertical-rl" }}>Split</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Ribbon + Left Sidebar */}
      <div style={{ display: "flex", height: "100%", flexShrink: 0 }}>
        {/* Obsidian-style icon ribbon */}
        <div
          style={{
            width: 44,
            background: "var(--bg-primary)",
            borderRight: "1px solid var(--bg-tertiary)",
            display: (zenMode || isMobile) ? "none" : "flex",
            flexDirection: "column",
            alignItems: "center",
            paddingTop: 8,
            gap: 2,
            flexShrink: 0,
          }}
        >
          {[
            {
              id: "files" as const,
              title: "File explorer",
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 3h7l2 2h9v15H3z" />
                  <path d="M3 10h18" />
                </svg>
              ),
            },
            {
              id: "search" as const,
              title: "Search",
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              ),
            },
            {
              id: "graph" as const,
              title: "Graph view",
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="6" cy="6" r="2.5" />
                  <circle cx="18" cy="8" r="2.5" />
                  <circle cx="12" cy="18" r="2.5" />
                  <path d="M8.2 7.5 15.5 9.5" />
                  <path d="M7.5 8.2 10.5 16" />
                  <path d="M15.8 10.2 13.5 16" />
                </svg>
              ),
            },
            {
              id: "starred" as const,
              title: "Starred notes",
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              ),
            },
            {
              id: "recent" as const,
              title: "Recent files",
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
              ),
            },
            {
              id: "plugins" as const,
              title: "Plugins",
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                  <path d="M9 4v16" />
                  <path d="M4 9h5" />
                </svg>
              ),
            },
            {
              id: "trash" as const,
              title: "Trash",
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              ),
            },
          ].map((item) => (
            <button
              key={item.id}
              title={item.title}
              onClick={() => {
                if (item.id === "graph") {
                  setShowGraph((g) => !g);
                } else if (leftPanel === item.id && !leftCollapsed) {
                  setLeftCollapsed(true);
                } else {
                  setLeftPanel(item.id);
                  setLeftCollapsed(false);
                  if (item.id === "trash") refreshTrash();
                }
              }}
              style={{
                width: 36,
                height: 36,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "none",
                borderRadius: 4,
                background: (item.id === "graph" ? showGraph : leftPanel === item.id) ? "var(--bg-tertiary)" : "transparent",
                color: (item.id === "graph" ? showGraph : leftPanel === item.id) ? "var(--text-primary)" : "var(--text-faint)",
                borderLeft: (item.id === "graph" ? showGraph : leftPanel === item.id && !leftCollapsed) ? "2px solid var(--accent-color)" : "2px solid transparent",
                cursor: "pointer",
                transition: "color 0.15s, background 0.15s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"; }}
              onMouseLeave={(e) => {
                const isActive = item.id === "graph" ? showGraph : leftPanel === item.id;
                (e.currentTarget as HTMLElement).style.color = isActive ? "var(--text-primary)" : "var(--text-faint)";
              }}
            >
              {item.icon}
            </button>
          ))}

          {/* Daily note / Calendar */}
          <button
            ref={calendarAnchorRef}
            title="Daily notes calendar (click) / Open today (Ctrl+D)"
            onClick={() => setShowCalendar((c) => !c)}
            style={{
              width: 36,
              height: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "none",
              borderRadius: 4,
              background: "transparent",
              color: "var(--text-faint)",
              cursor: "pointer",
              transition: "color 0.15s, background 0.15s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-faint)"; }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4" />
              <path d="M8 2v4" />
              <path d="M3 10h18" />
              <path d="M8 14h.01" />
              <path d="M12 14h.01" />
              <path d="M16 14h.01" />
              <path d="M8 18h.01" />
              <path d="M12 18h.01" />
            </svg>
          </button>

          <div style={{ flex: 1 }} />

          {/* Bottom ribbon actions */}
          <button
            title="Open random note"
            onClick={openRandomNote}
            style={{
              width: 36,
              height: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "none",
              borderRadius: 4,
              background: "transparent",
              color: "var(--text-faint)",
              cursor: "pointer",
              marginBottom: 4,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-faint)"; }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <circle cx="8" cy="10" r="1.5" fill="currentColor" stroke="none" />
              <circle cx="16" cy="10" r="1.5" fill="currentColor" stroke="none" />
              <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
              <circle cx="8" cy="16" r="1.5" fill="currentColor" stroke="none" />
              <circle cx="16" cy="16" r="1.5" fill="currentColor" stroke="none" />
            </svg>
          </button>
          <button
            title="Settings"
            onClick={() => setShowSettings(true)}
            style={{
              width: 36,
              height: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "none",
              borderRadius: 4,
              background: "transparent",
              color: "var(--text-faint)",
              cursor: "pointer",
              marginBottom: 8,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-faint)"; }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" />
            </svg>
          </button>
        </div>

        {/* Mobile sidebar backdrop */}
        {isMobile && !leftCollapsed && (
          <div
            onClick={() => setLeftCollapsed(true)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.4)",
              zIndex: 799,
            }}
          />
        )}

        {/* Sidebar panel */}
        <aside
          style={{
            width: leftCollapsed ? 0 : (isMobile ? "80vw" : leftWidth),
            minWidth: leftCollapsed ? 0 : (isMobile ? 200 : 140),
            borderRight: leftCollapsed ? "none" : "1px solid var(--border-color)",
            background: "var(--bg-secondary)",
            color: "var(--text-primary)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            transition: "width 0.2s ease, min-width 0.2s ease",
            ...(isMobile && !leftCollapsed ? {
              position: "fixed" as const,
              left: 0,
              top: 0,
              bottom: 0,
              zIndex: 800,
              boxShadow: "4px 0 16px rgba(0,0,0,0.5)",
            } : {
              position: "relative" as const,
            }),
          }}
        >
          <ResizeHandle side="left" onResize={handleLeftResize} />
          <div
            style={{
              padding: "10px 12px",
              borderBottom: "1px solid var(--border-color)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span style={{
              fontWeight: 600,
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--text-muted)",
            }}>
              {leftPanel === "files" ? "Files" : leftPanel === "search" ? "Search" : leftPanel === "starred" ? "Starred" : leftPanel === "recent" ? "Recent" : leftPanel === "trash" ? "Trash" : "Plugins"}
            </span>
            {leftPanel === "files" && (
              <div style={{ display: "flex", gap: 2 }}>
                <button
                  title={`New note (${kbd("Ctrl+N")})`}
                  onClick={createNewNote}
                  style={{
                    width: 24,
                    height: 24,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "none",
                    borderRadius: 3,
                    background: "transparent",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    fontSize: 16,
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                    <path d="M14 3v6h6" />
                    <path d="M12 12v6" />
                    <path d="M9 15h6" />
                  </svg>
                </button>
                <button
                  title="New folder"
                  onClick={() => {/* will trigger via context menu */}}
                  style={{
                    width: 24,
                    height: 24,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "none",
                    borderRadius: 3,
                    background: "transparent",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 5h7l2 2h9v12H3z" />
                    <path d="M12 11v6" />
                    <path d="M9 14h6" />
                  </svg>
                </button>
                {activeTab && (
                  <button
                    title="Reveal active file in file tree"
                    onClick={() => {
                      const el = document.querySelector(`.file-tree-item[data-path="${CSS.escape(activeTab.path)}"]`);
                      if (el) {
                        el.scrollIntoView({ behavior: "smooth", block: "center" });
                        (el as HTMLElement).style.background = "var(--accent-color)";
                        (el as HTMLElement).style.transition = "background 0.8s";
                        setTimeout(() => {
                          (el as HTMLElement).style.background = "";
                          (el as HTMLElement).style.transition = "";
                        }, 1000);
                      }
                    }}
                    style={{
                      width: 24,
                      height: 24,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "none",
                      borderRadius: 3,
                      background: "transparent",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <circle cx="12" cy="12" r="3" />
                      <line x1="12" y1="2" x2="12" y2="6" />
                      <line x1="12" y1="18" x2="12" y2="22" />
                      <line x1="2" y1="12" x2="6" y2="12" />
                      <line x1="18" y1="12" x2="22" y2="12" />
                    </svg>
                  </button>
                )}
              </div>
            )}
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: leftPanel === "files" || leftPanel === "starred" || leftPanel === "recent" || leftPanel === "trash" ? "4px 4px" : 0 }}>
            {leftPanel === "files" ? (
              tree.length > 0 ? (
                <FileTree
                  entries={tree}
                  onFileSelect={openTab}
                  onOpenInNewTab={(path) => {
                    // Always open in a new tab (don't reuse existing)
                    const id = nextTabId();
                    const newTab: Tab = { id, path, content: "", mode: "read", noteMeta: null, backlinks: [], unlinkedMentions: [], scrollTop: 0 };
                    setTabsMap((prev) => ({ ...prev, [id]: newTab }));
                    setPanes((prev) => {
                      const next = [...prev];
                      const pane = next[activePaneIdx];
                      next[activePaneIdx] = { ...pane, tabIds: [...pane.tabIds, id], activeTabId: id };
                      return next;
                    });
                    fetch(`/api/vault/file?path=${encodeURIComponent(path)}`)
                      .then((r) => r.json())
                      .then((data) => {
                        if (!data.error) updateTab(id, { content: data.content, missing: false, fileCreated: data.created, fileModified: data.modified, fileSize: data.size });
                      });
                    if (path.endsWith(".md")) {
                      fetch(`/api/vault/note?path=${encodeURIComponent(path)}`).then((r) => r.json()).then((data) => { if (!data.error) updateTab(id, { noteMeta: data }); });
                      fetch(`/api/vault/backlinks?path=${encodeURIComponent(path)}`).then((r) => r.json()).then((data) => { if (!data.error) updateTab(id, { backlinks: data.backlinks, unlinkedMentions: data.unlinkedMentions ?? [] }); });
                    }
                  }}
                  onOpenToRight={(path) => {
                    if (panes.length < 2) {
                      setPanes((prev) => [...prev, { tabIds: [], activeTabId: null }]);
                      setTimeout(() => openTab(path, panes.length), 0);
                    } else {
                      openTab(path, 1);
                    }
                  }}
                  selectedPath={activeTab?.path ?? null}
                  onMutate={refreshTree}
                  onFileRenamed={handleFileRenamed}
                  onDuplicate={duplicateNote}
                  backlinkCounts={backlinkCounts}
                  todoCounts={todoCounts}
                  onShowToast={showToast}
                />
              ) : (
                <div style={{ padding: 12, opacity: 0.5, fontSize: 13 }}>
                  Loading...
                </div>
              )
            ) : leftPanel === "search" ? (
              <SearchPanel
                onNavigate={(path, q, line) => { openTab(path); if (q) setReaderHighlight(q); if (line) setScrollToLine(line); }}
                initialQuery={searchQuery}
                onClose={() => setLeftPanel("files")}
                showToast={showToast}
                onCreateNote={async (title) => {
                  const path = `${title}.md`;
                  try {
                    await fetch(`/api/vault/file?path=${encodeURIComponent(path)}`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      credentials: "include",
                      body: JSON.stringify({ content: `# ${title}\n` }),
                    });
                    refreshTree();
                    openTab(path);
                    showToast(`Created "${title}"`);
                  } catch { /* ignore */ }
                }}
              />
            ) : leftPanel === "starred" ? (
              <div style={{ padding: "8px" }}>
                {starredNotes.length === 0 ? (
                  <div style={{ padding: 12, fontSize: 13, color: "var(--text-faint)" }}>
                    No starred notes yet. Right-click a tab to star a note.
                  </div>
                ) : (
                  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {starredNotes.map((path) => {
                      const name = path.replace(/\.md$/, "").split("/").pop() ?? path;
                      const isActive = activeTab?.path === path;
                      return (
                        <li key={path}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              padding: "4px 8px",
                              borderRadius: 3,
                              cursor: "pointer",
                              background: isActive ? "var(--bg-hover)" : "transparent",
                              color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                              fontSize: 13,
                              transition: "background 0.1s",
                            }}
                            onClick={() => openTab(path)}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              toggleStar(path);
                            }}
                            onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
                            onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                            title={`${path}\nRight-click to unstar`}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="#e6994a" stroke="#e6994a" strokeWidth="1.5">
                              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                            </svg>
                            <span>{name}</span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ) : leftPanel === "recent" ? (
              <div style={{ padding: "8px" }}>
                {recentFiles.length === 0 ? (
                  <div style={{ padding: 12, fontSize: 13, color: "var(--text-faint)" }}>
                    No recently opened files
                  </div>
                ) : (
                  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {recentFiles.map((path) => {
                      const name = path.replace(/\.md$/, "").split("/").pop() ?? path;
                      const isActive = activeTab?.path === path;
                      return (
                        <li key={path}>
                          <div
                            onClick={() => openTab(path)}
                            style={{
                              padding: "4px 8px",
                              fontSize: 13,
                              cursor: "pointer",
                              borderRadius: 3,
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              color: isActive ? "var(--accent-color)" : "var(--text-primary)",
                              background: isActive ? "rgba(127,109,242,0.08)" : "transparent",
                            }}
                            onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
                            onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                            title={path}
                          >
                            <span>{name}</span>
                            {path.includes("/") && (
                              <span style={{ fontSize: 11, color: "var(--text-faint)", marginLeft: "auto" }}>
                                {path.split("/").slice(0, -1).join("/")}
                              </span>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ) : leftPanel === "trash" ? (
              <div style={{ padding: "8px" }}>
                {trashFiles.length > 0 && (
                  <button
                    onClick={() => {
                      if (!confirm("Permanently delete all files in trash?")) return;
                      fetch("/api/vault/trash/empty", { method: "DELETE", credentials: "include" })
                        .then(() => { setTrashFiles([]); showToast("Trash emptied"); })
                        .catch(() => {});
                    }}
                    style={{ padding: "4px 10px", fontSize: 12, background: "rgba(255,80,80,0.15)", color: "#f55", border: "1px solid rgba(255,80,80,0.3)", borderRadius: 4, cursor: "pointer", marginBottom: 8, width: "100%" }}
                  >
                    Empty Trash ({trashFiles.length})
                  </button>
                )}
                {trashFiles.length === 0 ? (
                  <div style={{ padding: 12, fontSize: 13, color: "var(--text-faint)" }}>
                    Trash is empty
                  </div>
                ) : (
                  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {trashFiles.map((f) => {
                      const name = f.path.split("/").pop() ?? f.path;
                      return (
                        <li key={f.path} style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 4px", borderRadius: 3 }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>
                          <span style={{ flex: 1, fontSize: 13, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={f.path}>{name}</span>
                          <button
                            title="Restore"
                            onClick={() => {
                              fetch("/api/vault/trash/restore", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                credentials: "include",
                                body: JSON.stringify({ path: f.path }),
                              }).then(() => {
                                setTrashFiles((prev) => prev.filter((x) => x.path !== f.path));
                                refreshTree();
                                showToast(`Restored ${name}`);
                              }).catch(() => {});
                            }}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", padding: 2, lineHeight: 1, fontSize: 14 }}
                          >
                            ↩
                          </button>
                          <button
                            title="Delete permanently"
                            onClick={() => {
                              fetch(`/api/vault/file?path=.trash/${encodeURIComponent(f.path)}&permanent=true`, {
                                method: "DELETE",
                                credentials: "include",
                              }).then(() => {
                                setTrashFiles((prev) => prev.filter((x) => x.path !== f.path));
                                showToast(`Permanently deleted ${name}`);
                              }).catch(() => {});
                            }}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", padding: 2, lineHeight: 1, fontSize: 14 }}
                          >
                            ×
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ) : (
              <Plugins />
            )}
          </div>
        </aside>
      </div>

      {/* Left resize handle */}
      {!leftCollapsed && !isMobile && (
        <div
          style={{
            width: 4,
            cursor: "col-resize",
            background: "transparent",
            flexShrink: 0,
            position: "relative",
            zIndex: 10,
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            const startX = e.clientX;
            const startW = leftWidth;
            document.body.style.userSelect = "none";
            document.body.style.cursor = "col-resize";
            const onMove = (ev: MouseEvent) => {
              const newW = Math.max(140, Math.min(500, startW + ev.clientX - startX));
              setLeftWidth(newW);
            };
            const onUp = () => {
              document.removeEventListener("mousemove", onMove);
              document.removeEventListener("mouseup", onUp);
              document.body.style.userSelect = "";
              document.body.style.cursor = "";
            };
            document.addEventListener("mousemove", onMove);
            document.addEventListener("mouseup", onUp);
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-color)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        />
      )}

      {/* Main content area */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          background: "var(--bg-primary)",
          color: "var(--text-primary)",
          minWidth: 0,
        }}
      >
        {/* Error banner */}
        {error && (
          <div
            style={{
              padding: "8px 16px",
              background: "#5a1d1d",
              color: "#f88",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        {/* Pane container */}
        <div style={{ flex: 1, display: "flex", minHeight: 0, flexDirection: "column" }}>
        <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
          {showGraph ? (
            <Graph
              onNavigate={(path) => {
                setShowGraph(false);
                openTab(path);
              }}
              activePath={activeTab?.path}
            />
          ) : appSettings.stackedTabs ? (
            <div
              className="stacked-panes-container"
              style={{
                flex: 1,
                display: "flex",
                overflowX: "auto",
                overflowY: "hidden",
                scrollSnapType: "x mandatory",
              }}
            >
              {panes.flatMap((pane, paneIdx) =>
                pane.tabIds.map((tabId) => {
                  const tab = tabsMap[tabId];
                  if (!tab) return null;
                  const isActive = pane.activeTabId === tabId && paneIdx === activePaneIdx;
                  return (
                    <div
                      key={tabId}
                      className="stacked-pane-card"
                      style={{
                        minWidth: 500,
                        maxWidth: 700,
                        flex: "0 0 auto",
                        width: "50vw",
                        display: "flex",
                        flexDirection: "column",
                        borderRight: "1px solid var(--border-color)",
                        scrollSnapAlign: "start",
                        position: "relative",
                        background: isActive ? "var(--bg-primary)" : "var(--bg-secondary)",
                      }}
                      onClick={() => {
                        setActivePaneIdx(paneIdx);
                        setPanes((prev) => {
                          const next = [...prev];
                          next[paneIdx] = { ...prev[paneIdx], activeTabId: tabId };
                          return next;
                        });
                      }}
                    >
                      {/* Stacked pane header */}
                      <div
                        style={{
                          padding: "8px 16px",
                          borderBottom: "1px solid var(--border-color)",
                          fontSize: 13,
                          fontWeight: 500,
                          color: isActive ? "var(--text-primary)" : "var(--text-muted)",
                          background: isActive ? "var(--bg-tertiary)" : "transparent",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          position: "sticky",
                          top: 0,
                          zIndex: 1,
                        }}
                      >
                        <span>{tab.path.replace(/\.md$/, "").split("/").pop()}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); closeTab(tabId, paneIdx); }}
                          style={{
                            background: "none",
                            border: "none",
                            color: "var(--text-faint)",
                            cursor: "pointer",
                            fontSize: 14,
                            padding: "2px 4px",
                          }}
                        >
                          ×
                        </button>
                      </div>
                      {/* Stacked pane content */}
                      <div style={{ flex: 1, overflow: "auto", padding: 0 }}>
                        {tab.path.endsWith(".md") && tab.mode === "read" ? (
                          <Reader
                            content={tab.content}
                            filePath={tab.path}
                            onNavigate={handleNavigate}
                            searchHighlight=""
                            scrollToLine={null}
                            onScrollToLineDone={() => {}}
                          />
                        ) : tab.path.endsWith(".md") && (tab.mode === "edit" || tab.mode === "source") ? (
                          <Editor
                            content={tab.content}
                            filePath={tab.path}
                            onSave={(c: string) => { updateTab(tabId, { content: c }); handleSave(c); }}
                            onNavigate={handleNavigate}
                            onDirty={() => updateTab(tabId, { dirty: true })}
                            fontSize={appSettings.editorFontSize}
                            spellCheck={appSettings.spellCheck}
                            showLineNumbers={appSettings.showLineNumbers}
                            tabSize={appSettings.tabSize}
                            typewriterMode={appSettings.typewriterMode}
                            focusMode={appSettings.focusMode}
                            vimMode={appSettings.vimMode}
                            lineWrap={appSettings.lineWrap}
                            showWhitespace={appSettings.showWhitespace}
                            cursorBlinkRate={appSettings.cursorBlinkRate}
                            sourceMode={tab.mode === "source"}
                          />
                        ) : (
                          <div style={{ padding: 20, color: "var(--text-muted)", fontSize: 13 }}>
                            {tab.path}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            panes.map((pane, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && (
                  <div
                    ref={splitDivRef}
                    className="split-divider"
                    onMouseDown={handleSplitDrag}
                  />
                )}
                {renderPaneContent(pane, idx)}
              </React.Fragment>
            ))
          )}
        </div>

        {/* Status bar */}
        {!zenMode && activeTab && (
          <StatusBar content={activeTab.content} path={activeTab.path} cursorPos={activeTab.mode !== "read" ? cursorPos : null} saveStatus={saveStatus} fileCreated={activeTab.fileCreated} fileModified={activeTab.fileModified} scrollProgress={activeTab.mode === "read" ? scrollProgress : undefined} lineWrap={activeTab.mode !== "read" ? appSettings.lineWrap : undefined} />
        )}
        </div>
      </div>

      {/* Right resize handle */}
      {!rightCollapsed && !isMobile && activeTab && isMarkdown && (
        <div
          style={{
            width: 4,
            cursor: "col-resize",
            background: "transparent",
            flexShrink: 0,
            position: "relative",
            zIndex: 10,
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            const startX = e.clientX;
            const startW = rightWidth;
            document.body.style.userSelect = "none";
            document.body.style.cursor = "col-resize";
            const onMove = (ev: MouseEvent) => {
              const newW = Math.max(140, Math.min(500, startW - (ev.clientX - startX)));
              setRightWidth(newW);
            };
            const onUp = () => {
              document.removeEventListener("mousemove", onMove);
              document.removeEventListener("mouseup", onUp);
              document.body.style.userSelect = "";
              document.body.style.cursor = "";
            };
            document.addEventListener("mousemove", onMove);
            document.addEventListener("mouseup", onUp);
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-color)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        />
      )}

      {/* Right Sidebar */}
      <aside
        style={{
          width: isMobile || rightCollapsed || !activeTab || !isMarkdown ? 0 : rightWidth,
          minWidth: isMobile || rightCollapsed || !activeTab || !isMarkdown ? 0 : 140,
          borderLeft: isMobile || rightCollapsed || !activeTab || !isMarkdown ? "none" : "1px solid var(--border-color)",
          background: "var(--bg-secondary)",
          color: "var(--text-primary)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          position: "relative",
          transition: "width 0.2s ease, min-width 0.2s ease",
        }}
      >
        {activeTab && isMarkdown && (
          <>
            <ResizeHandle side="right" onResize={handleRightResize} />
            {(activeTab.noteMeta || activeTab.fileCreated) && (
              <SidebarSection title="Properties">
                <Properties
                  frontmatter={activeTab.noteMeta?.frontmatter ?? {}}
                  fileCreated={activeTab.fileCreated}
                  fileModified={activeTab.fileModified}
                  fileSize={activeTab.fileSize}
                  onUpdate={(key, value) => {
                    if (!activeTab) return;
                    const updated = updateFrontmatterField(activeTab.content, key, value);
                    updateTab(activeTab.id, { content: updated });
                    handleSave(updated);
                  }}
                  onDelete={(key) => {
                    if (!activeTab) return;
                    const updated = deleteFrontmatterField(activeTab.content, key);
                    updateTab(activeTab.id, { content: updated });
                    handleSave(updated);
                  }}
                  onAdd={(key, value) => {
                    if (!activeTab) return;
                    const updated = addFrontmatterField(activeTab.content, key, value);
                    updateTab(activeTab.id, { content: updated });
                    handleSave(updated);
                  }}
                />
              </SidebarSection>
            )}
            <SidebarSection title="File Info">
              <div style={{ padding: "4px 12px 8px", fontSize: 12, color: "var(--text-secondary)" }}>
                {(() => {
                  const text = activeTab.content.replace(/^---[\t ]*\r?\n[\s\S]*?\n---[\t ]*(?:\r?\n|$)/, "");
                  const words = text.trim().split(/\s+/).filter(Boolean).length;
                  const chars = text.length;
                  const links = (activeTab.content.match(/\[\[[^\]]+\]\]/g) ?? []).length;
                  const items: [string, string][] = [
                    ["Words", words.toLocaleString()],
                    ["Characters", chars.toLocaleString()],
                    ["Links", String(links)],
                    ["Backlinks", String(activeTab.backlinks.length)],
                  ];
                  if (activeTab.fileSize != null) {
                    const sz = activeTab.fileSize;
                    items.push(["Size", sz < 1024 ? `${sz} B` : sz < 1048576 ? `${(sz / 1024).toFixed(1)} KB` : `${(sz / 1048576).toFixed(1)} MB`]);
                  }
                  if (activeTab.fileCreated) items.push(["Created", new Date(activeTab.fileCreated).toLocaleDateString()]);
                  if (activeTab.fileModified) items.push(["Modified", new Date(activeTab.fileModified).toLocaleDateString()]);
                  return (
                    <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "3px 12px" }}>
                      {items.map(([label, val]) => (
                        <React.Fragment key={label}>
                          <span style={{ color: "var(--text-faint)" }}>{label}</span>
                          <span style={{ color: "var(--text-primary)", textAlign: "right" }}>{val}</span>
                        </React.Fragment>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </SidebarSection>
            <SidebarSection title="Backlinks" badge={activeTab.backlinks.length}>
              <Backlinks
                backlinks={activeTab.backlinks}
                onNavigate={openTab}
              />
            </SidebarSection>
            <SidebarSection title="Unlinked Mentions" badge={activeTab.unlinkedMentions.length}>
              {activeTab.unlinkedMentions.length === 0 ? (
                <div style={{ padding: "4px 12px", fontSize: 12, color: "var(--text-faint)" }}>No unlinked mentions</div>
              ) : (
                <div style={{ padding: "4px 12px 8px" }}>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {(() => {
                      const grouped = new Map<string, Array<{ line: number; lineContext: string }>>();
                      for (const m of activeTab.unlinkedMentions) {
                        if (!grouped.has(m.path)) grouped.set(m.path, []);
                        grouped.get(m.path)!.push({ line: m.line, lineContext: m.lineContext });
                      }
                      return [...grouped.entries()].map(([path, mentions]) => (
                        <li key={path} style={{ marginBottom: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <a
                              href="#"
                              onClick={(e) => { e.preventDefault(); openTab(path); }}
                              title={path}
                              style={{ color: "var(--accent-color)", textDecoration: "none", fontSize: 13, flex: 1 }}
                            >
                              {path.replace(/\.md$/, "").split("/").pop()}
                            </a>
                            <button
                              title="Link all mentions in this note"
                              onClick={async () => {
                                const basename = activeTab.path.replace(/\.md$/, "").split("/").pop() ?? "";
                                const res = await fetch(`/api/vault/file?path=${encodeURIComponent(path)}`, { credentials: "include" });
                                const data = await res.json();
                                if (data.error) return;
                                const re = new RegExp(`(?<!\\[\\[)\\b(${basename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})\\b(?!\\]\\])`, "gi");
                                const newContent = data.content.replace(re, "[[" + basename + "]]");
                                if (newContent !== data.content) {
                                  await fetch("/api/vault/file", {
                                    method: "PUT",
                                    headers: { "Content-Type": "application/json" },
                                    credentials: "include",
                                    body: JSON.stringify({ path, content: newContent }),
                                  });
                                  // Refresh backlinks
                                  fetch(`/api/vault/backlinks?path=${encodeURIComponent(activeTab.path)}`)
                                    .then((r) => r.json())
                                    .then((d) => { if (!d.error) updateTab(activeTab.id, { backlinks: d.backlinks, unlinkedMentions: d.unlinkedMentions ?? [] }); });
                                  showToast(`Linked mentions in ${path.replace(/\.md$/, "").split("/").pop()}`);
                                }
                              }}
                              style={{
                                background: "transparent", border: "1px solid var(--border-color)", borderRadius: 3,
                                color: "var(--accent-color)", fontSize: 10, padding: "1px 5px", cursor: "pointer",
                                lineHeight: 1.4, flexShrink: 0,
                              }}
                            >
                              Link
                            </button>
                          </div>
                          {mentions.slice(0, 3).map((m, i) => (
                            <div key={i} style={{
                              fontSize: 11, color: "var(--text-secondary)", marginTop: 2,
                              padding: "2px 0 2px 8px", borderLeft: "2px solid var(--border-color)",
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                              cursor: "pointer",
                            }} onClick={() => openTab(path)}>
                              {m.lineContext}
                            </div>
                          ))}
                          {mentions.length > 3 && (
                            <div style={{ fontSize: 10, color: "var(--text-faint)", paddingLeft: 8, marginTop: 2 }}>
                              +{mentions.length - 3} more
                            </div>
                          )}
                        </li>
                      ));
                    })()}
                  </ul>
                </div>
              )}
            </SidebarSection>
            <SidebarSection title="Outgoing Links" badge={(() => {
              const re = /\[\[([^\]|#]+)/g;
              const links = new Set<string>();
              let m;
              while ((m = re.exec(activeTab.content)) !== null) links.add(m[1].trim());
              return links.size;
            })()}>
              <OutgoingLinks content={activeTab.content} onNavigate={handleNavigate} tree={tree} />
            </SidebarSection>
            <SidebarSection title="Local Graph">
              <LocalGraph
                currentPath={activeTab.path}
                outgoingLinks={(() => {
                  const re = /\[\[([^\]|#]+)/g;
                  const links: string[] = [];
                  let m;
                  while ((m = re.exec(activeTab.content)) !== null) {
                    const target = m[1].trim();
                    const resolved = target.includes("/") ? target : target;
                    const path = resolved.endsWith(".md") ? resolved : `${resolved}.md`;
                    links.push(path);
                  }
                  return [...new Set(links)];
                })()}
                backlinkPaths={activeTab.backlinks.map((bl) => bl.path)}
                onNavigate={(path) => openTab(path)}
              />
            </SidebarSection>
            <SidebarSection title="Word Frequency">
              <WordFrequency content={activeTab.content} />
            </SidebarSection>
            <SidebarSection title="Outline">
              <Outline
                content={activeTab.content}
                onScrollToHeading={(heading, level) => scrollToHeadingRef.current?.(heading, level)}
                onReorderSection={(fromLine, fromLevel, toLine) => {
                  if (!activeTab) return;
                  const lines = activeTab.content.split("\n");
                  // Find section end: next heading at same or higher level, or EOF
                  let sectionEnd = lines.length;
                  for (let i = fromLine; i < lines.length; i++) { // fromLine is 1-based, lines[fromLine] is next line
                    const m = /^(#{1,6})\s/.exec(lines[i]);
                    if (m && m[1].length <= fromLevel) { sectionEnd = i; break; }
                  }
                  // Extract section (fromLine-1 is 0-based index)
                  const section = lines.slice(fromLine - 1, sectionEnd);
                  // Remove section from original
                  const remaining = [...lines.slice(0, fromLine - 1), ...lines.slice(sectionEnd)];
                  // Find new insert position (toLine adjusted for removed lines)
                  let insertAt = toLine - 1;
                  if (toLine > fromLine) insertAt -= section.length;
                  insertAt = Math.max(0, Math.min(insertAt, remaining.length));
                  // Insert
                  remaining.splice(insertAt, 0, ...section);
                  const newContent = remaining.join("\n");
                  updateTab(activeTab.id, { content: newContent, dirty: true });
                  // Save
                  fetch(`/api/vault/note?path=${encodeURIComponent(activeTab.path)}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ content: newContent }),
                  }).catch(() => {});
                }}
              />
            </SidebarSection>
            <SidebarSection title="Tags">
              <Tags onNavigate={openTab} />
            </SidebarSection>
            <SidebarSection title="CSS Snippets">
              <Snippets />
            </SidebarSection>
          </>
        )}
      </aside>

      {/* Quick Switcher modal */}
      {showSwitcher && (
        <QuickSwitcher
          onSelect={openTab}
          onClose={() => setShowSwitcher(false)}
          recentPaths={[...new Set(Object.values(tabsMap).map((t) => t.path))]}
          onCreateNote={(title) => {
            const path = title.endsWith(".md") ? title : `${title}.md`;
            fetch("/api/vault/file", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ path, content: "" }),
            }).then(() => {
              refreshTree();
              openTab(path);
              showToast(`Created ${path}`);
              setTimeout(() => {
                setPanes((prev) =>
                  prev.map((p) => {
                    const tid = p.tabIds.find((id) => tabsMap[id]?.path === path);
                    if (!tid) return p;
                    return { ...p, tabIds: p.tabIds, activeTabId: tid };
                  }),
                );
                setTabsMap((prev) => {
                  const entry = Object.entries(prev).find(([, t]) => t.path === path);
                  if (!entry) return prev;
                  return { ...prev, [entry[0]]: { ...entry[1], mode: "edit" } };
                });
              }, 100);
            });
          }}
        />
      )}

      {/* Command Palette modal */}
      {showCommandPalette && (() => {
        const hko = loadHotkeyOverrides();
        const hk = (id: string) => getHotkey(id, hko);
        return <CommandPalette
          commands={[
            {
              id: "new-note",
              name: "New Note",
              shortcut: hk("new-note"),
              action: createNewNote,
            },
            {
              id: "daily-note",
              name: "Open Daily Note",
              shortcut: hk("daily-note"),
              action: openDailyNote,
            },
            {
              id: "toggle-mode",
              name: activeTab?.mode === "read" ? "Switch to Live Preview" : activeTab?.mode === "edit" ? "Switch to Source Mode" : "Switch to Reading View",
              shortcut: hk("toggle-mode"),
              action: toggleMode,
            },
            {
              id: "quick-switcher",
              name: "Open Quick Switcher",
              shortcut: hk("quick-switcher"),
              action: () => setShowSwitcher(true),
            },
            {
              id: "toggle-search",
              name: leftPanel === "search" ? "Show File Tree" : "Show Search",
              shortcut: hk("search"),
              action: () => setLeftPanel((p) => (p === "search" ? "files" : "search")),
            },
            {
              id: "close-tab",
              name: "Close Active Tab",
              shortcut: hk("close-tab"),
              action: () => { if (activePane?.activeTabId) closeTab(activePane.activeTabId, activePaneIdx); },
            },
            {
              id: "undo-close-tab",
              name: "Undo Close Tab",
              shortcut: hk("undo-close-tab"),
              action: () => {
                const path = closedTabsStack.current.pop();
                if (path) openTab(path);
              },
            },
            {
              id: "toggle-graph",
              name: showGraph ? "Close Graph View" : "Open Graph View",
              shortcut: hk("graph-view"),
              action: () => setShowGraph((g) => !g),
            },
            {
              id: "logout",
              name: `Logout (${user})`,
              action: () => {
                fetch("/api/auth/logout", { method: "POST", credentials: "include" })
                  .then(() => {
                    setUser(null);
                    setTabsMap({});
                    setPanes([{ tabIds: [], activeTabId: null }]);
                    setTree([]);
                    localStorage.removeItem("obsidian-web-workspace");
                  });
              },
            },
            {
              id: "toggle-left-sidebar",
              name: leftCollapsed ? "Expand Left Sidebar" : "Collapse Left Sidebar",
              shortcut: hk("toggle-left-sidebar"),
              action: () => setLeftCollapsed((c) => !c),
            },
            {
              id: "toggle-right-sidebar",
              name: rightCollapsed ? "Expand Right Sidebar" : "Collapse Right Sidebar",
              shortcut: hk("toggle-right-sidebar"),
              action: () => setRightCollapsed((c) => !c),
            },
            {
              id: "toggle-zen-mode",
              name: zenMode ? "Exit Zen Mode" : "Enter Zen Mode",
              shortcut: hk("zen-mode"),
              action: toggleZenMode,
            },
            {
              id: "open-settings",
              name: "Open Settings",
              shortcut: hk("settings"),
              action: () => setShowSettings(true),
            },
            {
              id: "open-daily-note",
              name: "Open today's daily note",
              action: () => {
                // Trigger the daily note button click
                const btn = document.querySelector('[title="Open today\'s daily note"]') as HTMLButtonElement;
                btn?.click();
              },
            },
            {
              id: "toggle-stacked-tabs",
              name: appSettings.stackedTabs ? "Disable stacked tabs" : "Enable stacked tabs (sliding panes)",
              action: () => {
                const next = { ...appSettings, stackedTabs: !appSettings.stackedTabs };
                setAppSettings(next);
                import("./components/Settings.js").then(({ saveSettings }) => saveSettings(next));
              },
            },
            {
              id: "insert-template",
              name: "Insert template",
              action: () => setShowTemplatePicker(true),
            },
            {
              id: "manage-workspaces",
              name: "Manage workspaces",
              action: () => setShowWorkspaces(true),
            },
            {
              id: "random-note",
              name: "Open random note",
              action: openRandomNote,
            },
            {
              id: "export-html",
              name: "Export current note as HTML",
              action: exportAsHtml,
            },
            {
              id: "copy-embed-html",
              name: "Copy embeddable HTML to clipboard",
              action: () => {
                if (!activeTab?.content) { showToast("No active note"); return; }
                const md = createMarkdownRenderer();
                const body = activeTab.content.replace(/^---[\t ]*\r?\n[\s\S]*?\n---[\t ]*(?:\r?\n|$)/, "");
                const rendered = md.render(body);
                const title = activeTab.path.replace(/\.md$/, "").split("/").pop() || "Untitled";
                const embed = `<div class="obsidian-embed" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.65;font-size:16px;color:#dcddde;background:#1e1e1e;padding:24px 32px;border-radius:8px;max-width:750px;">
<h2 style="margin:0 0 12px;color:#e0e0e0;">${title}</h2>
${rendered}
<div style="margin-top:16px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.08);font-size:11px;color:#666;">Published from <a href="#" style="color:#7f6df2;text-decoration:none;">Websidian</a></div>
</div>`;
                navigator.clipboard.writeText(embed).then(() => showToast("Embeddable HTML copied to clipboard"));
              },
            },
            {
              id: "version-history",
              name: "Version history",
              action: () => { if (activeTab) setShowVersionHistory(true); },
            },
            {
              id: "merge-note",
              name: "Merge another note into current",
              action: () => { if (activeTab) setShowMergePicker(true); },
            },
            {
              id: "vault-stats",
              name: "Vault statistics",
              action: () => setShowVaultStats(true),
            },
            {
              id: "copy-link",
              name: "Copy note link",
              action: () => {
                if (!activeTab) return;
                const name = activeTab.path.replace(/\.md$/, "").split("/").pop() || activeTab.path;
                navigator.clipboard.writeText(`[[${name}]]`).catch(() => {});
                showToast(`Copied [[${name}]]`);
              },
            },
            {
              id: "move-file",
              name: "Move current file to...",
              action: () => {
                if (!activeTab) { showToast("No active file"); return; }
                setShowFolderPicker(true);
              },
            },
            {
              id: "extract-selection",
              name: "Extract current selection to new note",
              shortcut: "Ctrl+Shift+N",
              action: () => {
                // This triggers the editor's built-in keymap
                // Just inform the user to select text first
                if (activeTab?.mode !== "edit") {
                  showToast("Switch to edit mode and select text first");
                } else {
                  showToast("Select text in the editor, then press Ctrl+Shift+N");
                }
              },
            },
            {
              id: "split-at-heading",
              name: "Split note at heading…",
              action: () => {
                if (!activeTab) return;
                const content = activeTab.content;
                const lines = content.split("\n");
                // Find all headings
                const headings: Array<{ text: string; level: number; lineIdx: number }> = [];
                const fmMatch = /^---[\t ]*\r?\n[\s\S]*?\n---[\t ]*(?:\r?\n|$)/.exec(content);
                const fmLines = fmMatch ? fmMatch[0].split("\n").length - 1 : 0;
                for (let i = fmLines; i < lines.length; i++) {
                  const m = /^(#{1,6})\s+(.+)$/.exec(lines[i]);
                  if (m) headings.push({ text: m[2].trim(), level: m[1].length, lineIdx: i });
                }
                if (headings.length < 2) { showToast("Need at least 2 headings to split"); return; }
                // Use first non-first heading as split point (split off the second section)
                // For a simple UX, split at the second heading
                const splitIdx = headings[1].lineIdx;
                const splitHeading = headings[1].text;
                const before = lines.slice(0, splitIdx).join("\n").trimEnd();
                const after = lines.slice(splitIdx).join("\n");
                // New note name from heading
                const newName = splitHeading.replace(/[/\\:*?"<>|]/g, "").trim();
                const dir = activeTab.path.split("/").slice(0, -1).join("/");
                const newPath = dir ? `${dir}/${newName}.md` : `${newName}.md`;
                // Update current note (remove split section)
                const updatedContent = before + "\n\n[[" + newName + "]]\n";
                updateTab(activeTab.id, { content: updatedContent, dirty: true });
                fetch(`/api/vault/note?path=${encodeURIComponent(activeTab.path)}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({ content: updatedContent }),
                }).catch(() => {});
                // Create new note
                fetch(`/api/vault/note?path=${encodeURIComponent(newPath)}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({ content: after }),
                }).then(() => {
                  openTab(newPath);
                  refreshTree();
                  showToast(`Split into [[${newName}]]`);
                }).catch(() => {});
              },
            },
            {
              id: "rename-heading",
              name: "Rename heading and update links across vault",
              action: () => {
                if (!activeTab) return;
                const headings: string[] = [];
                for (const line of activeTab.content.split("\n")) {
                  const m = /^#{1,6}\s+(.+)$/.exec(line);
                  if (m) headings.push(m[1].trim());
                }
                if (headings.length === 0) { showToast("No headings found"); return; }
                const oldHeading = prompt("Which heading to rename?\n\n" + headings.map((h, i) => `${i + 1}. ${h}`).join("\n") + "\n\nEnter heading text:");
                if (!oldHeading || !headings.includes(oldHeading)) { showToast("Heading not found"); return; }
                const newHeading = prompt(`Rename "${oldHeading}" to:`);
                if (!newHeading || newHeading === oldHeading) return;
                // Update in current note
                const updated = activeTab.content.replace(
                  new RegExp(`^(#{1,6})\\s+${oldHeading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "m"),
                  `$1 ${newHeading}`,
                );
                updateTab(activeTab.id, { content: updated, dirty: true });
                fetch(`/api/vault/note?path=${encodeURIComponent(activeTab.path)}`, {
                  method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
                  body: JSON.stringify({ content: updated }),
                }).catch(() => {});
                // Update links across vault
                fetch("/api/vault/rename-heading", {
                  method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
                  body: JSON.stringify({ notePath: activeTab.path, oldHeading, newHeading }),
                }).then((r) => r.json()).then((data) => {
                  const count = data.updatedFiles?.length ?? 0;
                  showToast(count > 0 ? `Updated links in ${count} file${count !== 1 ? "s" : ""}` : "Heading renamed (no links to update)");
                }).catch(() => {});
              },
            },
            {
              id: "close-all-tabs",
              name: "Close all tabs",
              action: () => {
                const tabIds = activePane?.tabIds ?? [];
                tabIds.forEach((id) => closeTab(id, activePaneIdx));
              },
            },
            {
              id: "close-other-tabs",
              name: "Close other tabs",
              action: () => {
                const tabIds = activePane?.tabIds ?? [];
                const keepId = activePane?.activeTabId;
                tabIds.filter((id) => id !== keepId).forEach((id) => closeTab(id, activePaneIdx));
              },
            },
            {
              id: "reveal-in-tree",
              name: "Reveal active file in file tree",
              action: () => {
                if (!activeTab) return;
                setLeftPanel("files");
                setLeftCollapsed(false);
              },
            },
            {
              id: "toggle-line-numbers",
              name: appSettings.showLineNumbers ? "Hide line numbers" : "Show line numbers",
              action: () => {
                setAppSettings((s) => ({ ...s, showLineNumbers: !s.showLineNumbers }));
              },
            },
            {
              id: "increase-font",
              name: "Increase editor font size",
              action: () => {
                setAppSettings((s) => ({ ...s, editorFontSize: Math.min(24, (s.editorFontSize ?? 16) + 1) }));
              },
            },
            {
              id: "decrease-font",
              name: "Decrease editor font size",
              action: () => {
                setAppSettings((s) => ({ ...s, editorFontSize: Math.max(10, (s.editorFontSize ?? 16) - 1) }));
              },
            },
            {
              id: "fold-all",
              name: "Fold all headings",
              action: () => foldAllRef.current?.foldAll(),
            },
            {
              id: "unfold-all",
              name: "Unfold all headings",
              action: () => foldAllRef.current?.unfoldAll(),
            },
            {
              id: "insert-hr",
              name: "Insert horizontal rule",
              action: () => {
                if (!activeTab || activeTab.mode !== "edit") { showToast("Switch to edit mode"); return; }
                const lines = activeTab.content.split("\n");
                // Insert --- after the cursor line (approximate: at end of content)
                const updated = activeTab.content.trimEnd() + "\n\n---\n";
                updateTab(activeTab.id, { content: updated, dirty: true });
                fetch(`/api/vault/note?path=${encodeURIComponent(activeTab.path)}`, {
                  method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
                  body: JSON.stringify({ content: updated }),
                }).catch(() => {});
              },
            },
            {
              id: "insert-code-block",
              name: "Insert code block",
              action: () => {
                if (!activeTab || activeTab.mode !== "edit") { showToast("Switch to edit mode"); return; }
                const updated = activeTab.content.trimEnd() + "\n\n```\n\n```\n";
                updateTab(activeTab.id, { content: updated, dirty: true });
                fetch(`/api/vault/note?path=${encodeURIComponent(activeTab.path)}`, {
                  method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
                  body: JSON.stringify({ content: updated }),
                }).catch(() => {});
              },
            },
            {
              id: "insert-callout",
              name: "Insert callout block",
              action: () => {
                if (!activeTab || activeTab.mode !== "edit") { showToast("Switch to edit mode"); return; }
                const updated = activeTab.content.trimEnd() + "\n\n> [!note]\n> \n";
                updateTab(activeTab.id, { content: updated, dirty: true });
                fetch(`/api/vault/note?path=${encodeURIComponent(activeTab.path)}`, {
                  method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
                  body: JSON.stringify({ content: updated }),
                }).catch(() => {});
              },
            },
            {
              id: "sort-lines",
              name: "Sort lines alphabetically",
              action: () => {
                if (!activeTab || activeTab.mode !== "edit") { showToast("Switch to edit mode"); return; }
                const lines = activeTab.content.split("\n");
                const sorted = [...lines].sort((a, b) => a.localeCompare(b));
                const updated = sorted.join("\n");
                updateTab(activeTab.id, { content: updated, dirty: true });
                fetch(`/api/vault/note?path=${encodeURIComponent(activeTab.path)}`, {
                  method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
                  body: JSON.stringify({ content: updated }),
                }).catch(() => {});
                showToast("Lines sorted");
              },
            },
            {
              id: "reverse-lines",
              name: "Reverse lines",
              action: () => {
                if (!activeTab || activeTab.mode !== "edit") { showToast("Switch to edit mode"); return; }
                const lines = activeTab.content.split("\n");
                const updated = lines.reverse().join("\n");
                updateTab(activeTab.id, { content: updated, dirty: true });
                fetch(`/api/vault/note?path=${encodeURIComponent(activeTab.path)}`, {
                  method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
                  body: JSON.stringify({ content: updated }),
                }).catch(() => {});
                showToast("Lines reversed");
              },
            },
            {
              id: "toggle-readable-length",
              name: appSettings.readableLineLength ? "Disable readable line length" : "Enable readable line length",
              action: () => {
                const next = { ...appSettings, readableLineLength: !appSettings.readableLineLength };
                setAppSettings(next);
                import("./components/Settings.js").then(({ saveSettings }) => saveSettings(next));
              },
            },
            {
              id: "toggle-spellcheck",
              name: appSettings.spellCheck ? "Disable spell check" : "Enable spell check",
              action: () => {
                const next = { ...appSettings, spellCheck: !appSettings.spellCheck };
                setAppSettings(next);
                import("./components/Settings.js").then(({ saveSettings }) => saveSettings(next));
              },
            },
            ...(panes.length < 2
              ? [{
                  id: "split-right",
                  name: "Split Right",
                  action: splitRight,
                }]
              : [{
                  id: "close-split",
                  name: "Close Split Pane",
                  action: closeSplit,
                }]),
          ]}
          onClose={() => setShowCommandPalette(false)}
        />;
      })()}
      {/* Tab context menu */}
      {tabCtxMenu && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 900 }}
          onClick={() => setTabCtxMenu(null)}
          onContextMenu={(e) => { e.preventDefault(); setTabCtxMenu(null); }}
        >
          <div
            style={{
              position: "absolute",
              left: tabCtxMenu.x,
              top: tabCtxMenu.y,
              background: "var(--bg-tertiary)",
              border: "1px solid var(--border-color)",
              borderRadius: 6,
              padding: "4px 0",
              minWidth: 160,
              boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
              fontSize: 13,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {[
              {
                label: tabsMap[tabCtxMenu.tabId]?.pinned ? "Unpin Tab" : "Pin Tab",
                action: () => {
                  const tab = tabsMap[tabCtxMenu.tabId];
                  if (tab) updateTab(tabCtxMenu.tabId, { pinned: !tab.pinned });
                },
              },
              { type: "separator" as const },
              { label: "Close", action: () => closeTab(tabCtxMenu.tabId, tabCtxMenu.paneIdx) },
              {
                label: "Close Others",
                action: () => {
                  const pane = panes[tabCtxMenu.paneIdx];
                  const others = pane.tabIds.filter((t) => t !== tabCtxMenu.tabId && !tabsMap[t]?.pinned);
                  for (const tid of others) closeTab(tid, tabCtxMenu.paneIdx);
                },
              },
              {
                label: "Close All",
                action: () => {
                  const pane = panes[tabCtxMenu.paneIdx];
                  for (const tid of [...pane.tabIds]) {
                    if (!tabsMap[tid]?.pinned) closeTab(tid, tabCtxMenu.paneIdx);
                  }
                },
              },
              {
                label: "Close Tabs to the Right",
                action: () => {
                  const pane = panes[tabCtxMenu.paneIdx];
                  const idx = pane.tabIds.indexOf(tabCtxMenu.tabId);
                  const right = pane.tabIds.slice(idx + 1).filter((t) => !tabsMap[t]?.pinned);
                  for (const tid of right) closeTab(tid, tabCtxMenu.paneIdx);
                },
              },
              {
                label: "Close Tabs to the Left",
                action: () => {
                  const pane = panes[tabCtxMenu.paneIdx];
                  const idx = pane.tabIds.indexOf(tabCtxMenu.tabId);
                  const left = pane.tabIds.slice(0, idx).filter((t) => !tabsMap[t]?.pinned);
                  for (const tid of left) closeTab(tid, tabCtxMenu.paneIdx);
                },
              },
              { type: "separator" as const },
              {
                label: "Copy Path",
                action: () => {
                  const tab = tabsMap[tabCtxMenu.tabId];
                  if (tab) {
                    navigator.clipboard.writeText(tab.path).catch(() => {});
                    showToast("Path copied to clipboard");
                  }
                },
              },
              {
                label: "Copy Note Link",
                action: () => {
                  const tab = tabsMap[tabCtxMenu.tabId];
                  if (tab) {
                    const name = tab.path.replace(/\.md$/, "").split("/").pop() || tab.path;
                    navigator.clipboard.writeText(`[[${name}]]`).catch(() => {});
                    showToast(`Copied [[${name}]]`);
                  }
                },
              },
              {
                label: "Share Note",
                action: () => {
                  const tab = tabsMap[tabCtxMenu.tabId];
                  if (!tab) return;
                  fetch("/api/vault/share", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ path: tab.path }),
                  })
                    .then((r) => r.json())
                    .then((data) => {
                      if (data.url) {
                        const shareUrl = `${window.location.origin}/#/share/${data.id}`;
                        navigator.clipboard.writeText(shareUrl).catch(() => {});
                        showToast(`Share link copied!`);
                      }
                    });
                },
              },
              {
                label: "Reveal in File Tree",
                action: () => setLeftPanel("files"),
              },
              {
                label: "Duplicate",
                action: () => {
                  const tab = tabsMap[tabCtxMenu.tabId];
                  if (tab) duplicateNote(tab.path);
                },
              },
              {
                label: starredNotes.includes(tabsMap[tabCtxMenu.tabId]?.path) ? "Unstar" : "Star",
                action: () => {
                  const tab = tabsMap[tabCtxMenu.tabId];
                  if (tab) toggleStar(tab.path);
                },
              },
              {
                label: "Color",
                type: "color-picker" as const,
                action: () => {},
              },
              { type: "separator" as const },
              {
                label: "Split Right",
                action: () => {
                  const tab = tabsMap[tabCtxMenu.tabId];
                  if (!tab || panes.length >= 2) return;
                  const newPaneTabId = nextTabId();
                  const newTab: Tab = { ...tab, id: newPaneTabId };
                  setTabsMap((prev) => ({ ...prev, [newPaneTabId]: newTab }));
                  setPanes((prev) => [...prev, { tabIds: [newPaneTabId], activeTabId: newPaneTabId }]);
                  // Load content for the new tab
                  fetch(`/api/vault/file?path=${encodeURIComponent(tab.path)}`, { credentials: "include" })
                    .then((r) => r.json())
                    .then((d) => { if (!d.error) updateTab(newPaneTabId, { content: d.content, fileCreated: d.created, fileModified: d.modified, fileSize: d.size }); });
                },
              },
            ].map((item, i) =>
              "type" in item && item.type === "separator" ? (
                <div key={i} style={{ borderTop: "1px solid var(--border-color)", margin: "4px 0" }} />
              ) : "type" in item && item.type === "color-picker" ? (
                <div key={i} style={{ padding: "4px 12px", display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", marginRight: 4 }}>Color</span>
                  {["", "#e06c75", "#e5c07b", "#98c379", "#61afef", "#c678dd", "#56b6c2"].map((c) => (
                    <span
                      key={c || "none"}
                      onClick={() => {
                        updateTab(tabCtxMenu.tabId, { color: c || undefined });
                        setTabCtxMenu(null);
                      }}
                      style={{
                        width: 14, height: 14, borderRadius: "50%", cursor: "pointer",
                        background: c || "var(--bg-tertiary)",
                        border: (tabsMap[tabCtxMenu.tabId]?.color ?? "") === c ? "2px solid var(--text-primary)" : "1px solid var(--border-color)",
                        transition: "transform 0.1s",
                      }}
                      onMouseEnter={(e) => { (e.target as HTMLElement).style.transform = "scale(1.3)"; }}
                      onMouseLeave={(e) => { (e.target as HTMLElement).style.transform = "scale(1)"; }}
                      title={c ? c : "None"}
                    />
                  ))}
                </div>
              ) : (
                <div
                  key={i}
                  style={{
                    padding: "6px 12px",
                    cursor: "pointer",
                    color: "var(--text-primary)",
                  }}
                  onMouseEnter={(e) => { (e.target as HTMLElement).style.background = "var(--bg-hover)"; }}
                  onMouseLeave={(e) => { (e.target as HTMLElement).style.background = "transparent"; }}
                  onClick={() => {
                    (item as { action: () => void }).action();
                    setTabCtxMenu(null);
                  }}
                >
                  {(item as { label: string }).label}
                </div>
              ),
            )}
          </div>
        </div>
      )}

      {/* Template Picker */}
      {showTemplatePicker && (
        <TemplatePicker
          templatesFolder={appSettings.templatesFolder}
          onSelect={async (templatePath) => {
            setShowTemplatePicker(false);
            if (!activeTab) return;
            const res = await fetch(`/api/vault/file?path=${encodeURIComponent(templatePath)}`, { credentials: "include" });
            const data = await res.json();
            if (data.error || !data.content) return;
            // Process template variables
            const now = new Date();
            const title = activeTab.path.replace(/\.md$/, "").split("/").pop() ?? "";
            const content = data.content
              .replace(/\{\{date\}\}/g, `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`)
              .replace(/\{\{time\}\}/g, `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`)
              .replace(/\{\{title\}\}/g, title);
            // Append to current note content
            const updated = activeTab.content ? activeTab.content + "\n" + content : content;
            const tabId = panes[activePaneIdx].activeTabId;
            if (tabId) {
              updateTab(tabId, { content: updated });
              handleSave(updated);
            }
          }}
          onClose={() => setShowTemplatePicker(false)}
        />
      )}

      {/* Keyboard Shortcuts overlay */}
      {showShortcuts && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowShortcuts(false)}
        >
          <div
            style={{
              background: "var(--bg-tertiary)",
              border: "1px solid var(--border-color)",
              borderRadius: 8,
              padding: "24px 32px",
              maxWidth: 480,
              width: "90%",
              maxHeight: "80vh",
              overflow: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16 }}>
              Keyboard Shortcuts
            </div>
            {(() => {
              const hko = loadHotkeyOverrides();
              const hk = (id: string) => getHotkey(id, hko);
              return [
              ["Navigation", [
                [hk("quick-switcher"), "Quick switcher"],
                [hk("command-palette"), "Command palette"],
                [hk("toggle-mode"), "Toggle read/edit mode"],
                [hk("next-tab"), "Next tab"],
                [hk("prev-tab"), "Previous tab"],
                ["Ctrl+1-9", "Switch to Nth tab (9 = last)"],
                [hk("graph-view"), "Toggle graph view"],
              ]],
              ["Files", [
                [hk("new-note"), "New note"],
                [hk("daily-note"), "Open daily note"],
                [hk("close-tab"), "Close active tab"],
                [hk("undo-close-tab"), "Undo close tab"],
                ["Ctrl+Shift+N", "Extract selection to note"],
              ]],
              ["Editing", [
                ["Ctrl+D", "Select next occurrence"],
                ["Ctrl+F", "Find in editor"],
                ["Ctrl+H", "Find & replace"],
                ["Ctrl+B", "Bold"],
                ["Ctrl+I", "Italic"],
                ["Ctrl+K", "Insert link"],
                ["Ctrl+`", "Inline code"],
                ["Ctrl+Shift+X", "Strikethrough"],
                ["Ctrl+Enter", "Toggle list/task cycle"],
                ["Enter", "Continue list on new line"],
                ["Alt+↑/↓", "Move line up/down"],
                ["Alt+Shift+↑/↓", "Copy line up/down"],
                ["Ctrl+Shift+D", "Duplicate line/selection"],
                ["Ctrl+Shift+[", "Fold heading"],
                ["Ctrl+Shift+]", "Unfold heading"],
                ["[[", "Auto-close wikilink brackets"],
              ]],
              ["Interface", [
                [hk("toggle-left-sidebar"), "Toggle left sidebar"],
                [hk("toggle-right-sidebar"), "Toggle right sidebar"],
                [hk("search"), "Toggle search"],
                [hk("zen-mode"), "Toggle zen mode"],
                [hk("settings"), "Open settings"],
                [hk("shortcuts-help"), "Keyboard shortcuts"],
                [hk("split-right"), "Split editor right"],
                [hk("close-split"), "Close split pane"],
                [hk("focus-pane-1"), "Focus pane 1"],
                [hk("focus-pane-2"), "Focus pane 2"],
              ]],
            ] as [string, string[][]][];
            })().map(([group, shortcuts]) => (
              <div key={group}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em", padding: "10px 0 4px", marginTop: 4 }}>
                  {group}
                </div>
                {shortcuts.map(([key, desc]) => (
                  <div
                    key={key}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "5px 0",
                      borderBottom: "1px solid var(--bg-tertiary)",
                    }}
                  >
                    <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>{desc}</span>
                    <kbd
                      style={{
                        background: "var(--bg-primary)",
                        border: "1px solid var(--text-faint)",
                        borderRadius: 4,
                        padding: "2px 8px",
                        fontSize: 12,
                        color: "var(--text-primary)",
                        fontFamily: "system-ui, monospace",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {kbd(key)}
                    </kbd>
                  </div>
                ))}
              </div>
            ))}
            <div style={{ marginTop: 12, fontSize: 11, color: "var(--text-faint)", textAlign: "center" }}>
              Press Escape or Ctrl+/ to close
            </div>
          </div>
        </div>
      )}
      {/* Settings modal */}
      {showSettings && (
        <Settings
          settings={appSettings}
          onUpdate={setAppSettings}
          onClose={() => { setShowSettings(false); refreshHotkeyMap(); }}
        />
      )}

      {showVaultStats && (
        <VaultStats
          onClose={() => setShowVaultStats(false)}
          onNavigate={openTab}
        />
      )}

      {showMergePicker && activeTab && (
        <QuickSwitcher
          onSelect={(path) => {
            setShowMergePicker(false);
            mergeNoteInto(path);
          }}
          onClose={() => setShowMergePicker(false)}
        />
      )}

      {showVersionHistory && activeTab && (
        <VersionHistory
          path={activeTab.path}
          currentContent={activeTab.content}
          onRestore={(content) => {
            updateTab(activeTab.id, { content, dirty: true });
            handleSave(content);
          }}
          onClose={() => setShowVersionHistory(false)}
        />
      )}

      {showCalendar && (
        <Calendar
          anchorRect={calendarAnchorRef.current?.getBoundingClientRect() ?? null}
          onSelectDate={(dateStr) => openDailyByDate(dateStr)}
          onClose={() => setShowCalendar(false)}
        />
      )}

      {showWorkspaces && (
        <WorkspaceManager
          onClose={() => setShowWorkspaces(false)}
          getCurrentSnapshot={() => ({
            tabs: Object.values(tabsMap).map((t) => ({ id: t.id, path: t.path, mode: t.mode })),
            panes: panes.map((p) => ({ tabIds: p.tabIds, activeTabId: p.activeTabId })),
            activePaneIdx,
            leftPanel,
            leftWidth,
            rightWidth,
            splitRatio,
            leftCollapsed,
            rightCollapsed,
          })}
          onLoad={(snapshot) => {
            // Restore workspace from snapshot
            const newTabsMap: Record<string, typeof tabsMap[string]> = {};
            for (const t of snapshot.tabs) {
              newTabsMap[t.id] = {
                id: t.id,
                path: t.path,
                content: "",
                mode: t.mode as ViewMode,
                noteMeta: null,
                backlinks: [],
                unlinkedMentions: [],
                scrollTop: 0,
              };
              // Fetch content
              fetch(`/api/vault/file?path=${encodeURIComponent(t.path)}`, { credentials: "include" })
                .then((r) => r.json())
                .then((d) => { if (!d.error) updateTab(t.id, { content: d.content, fileCreated: d.created, fileModified: d.modified, fileSize: d.size }); })
                .catch(() => {});
              if (t.path.endsWith(".md")) {
                fetch(`/api/vault/note?path=${encodeURIComponent(t.path)}`, { credentials: "include" })
                  .then((r) => r.json())
                  .then((d) => { if (!d.error) updateTab(t.id, { noteMeta: d }); })
                  .catch(() => {});
                fetch(`/api/vault/backlinks?path=${encodeURIComponent(t.path)}`, { credentials: "include" })
                  .then((r) => r.json())
                  .then((d) => { if (!d.error) updateTab(t.id, { backlinks: d.backlinks, unlinkedMentions: d.unlinkedMentions ?? [] }); })
                  .catch(() => {});
              }
            }
            setTabsMap(newTabsMap);
            setPanes(snapshot.panes);
            setActivePaneIdx(snapshot.activePaneIdx);
            setLeftPanel(snapshot.leftPanel as typeof leftPanel);
            setLeftWidth(snapshot.leftWidth);
            setRightWidth(snapshot.rightWidth);
            setSplitRatio(snapshot.splitRatio);
            setLeftCollapsed(snapshot.leftCollapsed);
            setRightCollapsed(snapshot.rightCollapsed);
          }}
          showToast={showToast}
        />
      )}

      {/* Folder picker for Move file */}
      {showFolderPicker && activeTab && (() => {
        const collectFolders = (entries: VaultEntry[], prefix = ""): string[] => {
          const folders: string[] = [];
          for (const e of entries) {
            if (e.kind === "folder") {
              folders.push(e.path);
              folders.push(...collectFolders(e.children, e.path + "/"));
            }
          }
          return folders;
        };
        const allFolders = ["(root)", ...collectFolders(tree)];
        return (
          <FolderPicker
            folders={allFolders}
            currentPath={activeTab.path}
            onSelect={async (folder) => {
              setShowFolderPicker(false);
              const name = activeTab.path.split("/").pop()!;
              const newPath = folder === "(root)" ? name : `${folder}/${name}`;
              if (newPath === activeTab.path) return;
              const res = await fetch("/api/vault/rename", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ from: activeTab.path, to: newPath }),
              });
              if (res.ok) {
                const data = await res.json();
                handleFileRenamed(activeTab.path, newPath, data.updatedFiles ?? []);
                refreshTree();
                showToast(`Moved to ${folder === "(root)" ? "vault root" : folder}`);
              }
            }}
            onClose={() => setShowFolderPicker(false)}
          />
        );
      })()}

      {/* Toast notification */}
      {toast && (
        <div style={{
          position: "fixed",
          bottom: 32,
          left: "50%",
          transform: "translateX(-50%)",
          background: "var(--border-color)",
          color: "var(--text-primary)",
          padding: "8px 20px",
          borderRadius: 6,
          fontSize: 13,
          boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
          zIndex: 2000,
          pointerEvents: "none",
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
