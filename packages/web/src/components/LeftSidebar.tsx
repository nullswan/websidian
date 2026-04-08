import React, { useCallback } from "react";
import { FileTree } from "./FileTree.js";
import { SearchPanel } from "./SearchPanel.js";
import { Plugins } from "./Plugins.js";
import { ResizeHandle } from "./ResizeHandle.js";
import type { Tab, Pane } from "../lib/appTypes.js";
import type { VaultEntry } from "../types.js";

type LeftPanel = "files" | "search" | "plugins" | "starred" | "recent" | "trash";

interface TrashFile {
  path: string;
  deletedAt: string;
}

export interface LeftSidebarProps {
  leftPanel: LeftPanel;
  leftCollapsed: boolean;
  leftWidth: number;
  isMobile: boolean;

  setLeftCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  setLeftWidth: React.Dispatch<React.SetStateAction<number>>;
  setLeftPanel: React.Dispatch<React.SetStateAction<LeftPanel>>;
  handleLeftResize: (delta: number) => void;

  tree: VaultEntry[];
  activeTab: Tab | null;
  activePaneIdx: number;
  panes: Pane[];

  openTab: (path: string, paneIdx?: number) => void;
  refreshTree: () => void;
  handleFileRenamed: (oldPath: string, newPath: string, updatedFiles: string[]) => void;
  duplicateNote: (path: string) => void;
  createNewNote: () => void;
  setTabsMap: React.Dispatch<React.SetStateAction<Record<string, Tab>>>;
  setPanes: React.Dispatch<React.SetStateAction<Pane[]>>;
  updateTab: (id: string, patch: Partial<Tab>) => void;
  nextTabId: () => string;

  searchQuery: string;
  setReaderHighlight: (q: string) => void;
  setScrollToLine: (line: number) => void;

  starredNotes: string[];
  toggleStar: (path: string) => void;
  recentFiles: string[];
  trashFiles: TrashFile[];
  setTrashFiles: React.Dispatch<React.SetStateAction<TrashFile[]>>;

  backlinkCounts: Record<string, number>;
  todoCounts: Record<string, number>;
  gitStatus: Record<string, string>;
  showToast: (msg: string) => void;
  showFileExtensions: boolean;
  kbd: (shortcut: string) => string;
}

export const LeftSidebar = React.memo(function LeftSidebar(props: LeftSidebarProps) {
  const {
    leftPanel, leftCollapsed, leftWidth, isMobile,
    setLeftCollapsed, setLeftWidth, setLeftPanel, handleLeftResize,
    tree, activeTab, activePaneIdx, panes,
    openTab, refreshTree, handleFileRenamed, duplicateNote, createNewNote,
    setTabsMap, setPanes, updateTab, nextTabId,
    searchQuery, setReaderHighlight, setScrollToLine,
    starredNotes, toggleStar, recentFiles,
    trashFiles, setTrashFiles,
    backlinkCounts, todoCounts, gitStatus,
    showToast, showFileExtensions, kbd,
  } = props;

  const onOpenInNewTab = useCallback((path: string) => {
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
  }, [nextTabId, setTabsMap, setPanes, activePaneIdx, updateTab]);

  const onOpenToRight = useCallback((path: string) => {
    if (panes.length < 2) {
      setPanes((prev) => [...prev, { tabIds: [], activeTabId: null }]);
      setTimeout(() => openTab(path, panes.length), 0);
    } else {
      openTab(path, 1);
    }
  }, [panes.length, setPanes, openTab]);

  const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
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
  }, [leftWidth, setLeftWidth]);

  const panelTitle = leftPanel === "files" ? "Files"
    : leftPanel === "search" ? "Search"
    : leftPanel === "starred" ? "Starred"
    : leftPanel === "recent" ? "Recent"
    : leftPanel === "trash" ? "Trash"
    : "Plugins";

  const contentPadding = leftPanel === "files" || leftPanel === "starred" || leftPanel === "recent" || leftPanel === "trash" ? "4px 4px" : 0;

  return (
    <>
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
            {panelTitle}
          </span>
          {leftPanel === "files" && (
            <div style={{ display: "flex", gap: 2 }}>
              <button
                title={`New note (${kbd("Ctrl+N")})`}
                onClick={createNewNote}
                style={{
                  width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center",
                  border: "none", borderRadius: 3, background: "transparent", color: "var(--text-muted)", cursor: "pointer", fontSize: 16,
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
                onClick={() => {/* triggers via context menu */}}
                style={{
                  width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center",
                  border: "none", borderRadius: 3, background: "transparent", color: "var(--text-muted)", cursor: "pointer",
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
                    width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center",
                    border: "none", borderRadius: 3, background: "transparent", color: "var(--text-muted)", cursor: "pointer",
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
        <div style={{ flex: 1, overflow: "auto", padding: contentPadding }}>
          {leftPanel === "files" ? (
            tree.length > 0 ? (
              <FileTree
                entries={tree}
                onFileSelect={openTab}
                onOpenInNewTab={onOpenInNewTab}
                onOpenToRight={onOpenToRight}
                selectedPath={activeTab?.path ?? null}
                onMutate={refreshTree}
                onFileRenamed={handleFileRenamed}
                onDuplicate={duplicateNote}
                backlinkCounts={backlinkCounts}
                todoCounts={todoCounts}
                gitStatus={gitStatus}
                onShowToast={showToast}
                showFileExtensions={showFileExtensions}
              />
            ) : (
              <div style={{ padding: 12, opacity: 0.5, fontSize: 13 }}>Loading...</div>
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
            <StarredPanel starredNotes={starredNotes} activeTab={activeTab} openTab={openTab} toggleStar={toggleStar} />
          ) : leftPanel === "recent" ? (
            <RecentPanel recentFiles={recentFiles} activeTab={activeTab} openTab={openTab} tree={tree} />
          ) : leftPanel === "trash" ? (
            <TrashPanel trashFiles={trashFiles} setTrashFiles={setTrashFiles} refreshTree={refreshTree} showToast={showToast} />
          ) : (
            <Plugins />
          )}
        </div>
      </aside>

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
          onMouseDown={onResizeMouseDown}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-color)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        />
      )}
    </>
  );
});

/* ─── Sub-components ─── */

function StarredPanel({ starredNotes, activeTab, openTab, toggleStar }: {
  starredNotes: string[]; activeTab: Tab | null; openTab: (path: string) => void; toggleStar: (path: string) => void;
}) {
  if (starredNotes.length === 0) {
    return <div style={{ padding: "8px" }}><div style={{ padding: 12, fontSize: 13, color: "var(--text-faint)" }}>No starred notes yet. Right-click a tab to star a note.</div></div>;
  }
  return (
    <div style={{ padding: "8px" }}>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {starredNotes.map((path) => {
          const name = path.replace(/\.md$/, "").split("/").pop() ?? path;
          const isActive = activeTab?.path === path;
          return (
            <li key={path}>
              <div
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", borderRadius: 3, cursor: "pointer",
                  background: isActive ? "var(--bg-hover)" : "transparent",
                  color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                  fontSize: 13, transition: "background 0.1s",
                }}
                onClick={() => openTab(path)}
                onContextMenu={(e) => { e.preventDefault(); toggleStar(path); }}
                onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
                onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                title={`${path}\nRight-click to unstar`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--color-orange)" stroke="var(--color-orange)" strokeWidth="1.5">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                <span>{name}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function RecentPanel({ recentFiles, activeTab, openTab, tree }: {
  recentFiles: string[]; activeTab: Tab | null; openTab: (path: string) => void; tree: VaultEntry[];
}) {
  if (recentFiles.length === 0) {
    return <div style={{ padding: "8px" }}><div style={{ padding: 12, fontSize: 13, color: "var(--text-faint)" }}>No recently opened files</div></div>;
  }
  const findMtime = (entries: VaultEntry[], path: string): number | undefined => {
    for (const e of entries) {
      if (e.kind === "file" && e.path === path) return e.mtime;
      if (e.kind === "folder") { const m = findMtime(e.children, path); if (m) return m; }
    }
    return undefined;
  };
  return (
    <div style={{ padding: "8px" }}>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {recentFiles.map((path) => {
          const name = path.replace(/\.md$/, "").split("/").pop() ?? path;
          const isActive = activeTab?.path === path;
          const mtime = findMtime(tree, path);
          const relTime = mtime ? (() => {
            const diff = Date.now() - mtime;
            if (diff < 60000) return "just now";
            if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
            if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
            return `${Math.floor(diff / 86400000)}d ago`;
          })() : null;
          return (
            <li key={path}>
              <div
                onClick={() => openTab(path)}
                style={{
                  padding: "4px 8px", fontSize: 13, cursor: "pointer", borderRadius: 3,
                  display: "flex", alignItems: "center", gap: 6,
                  color: isActive ? "var(--accent-color)" : "var(--text-primary)",
                  background: isActive ? "rgba(127,109,242,0.08)" : "transparent",
                }}
                onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
                onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                title={path}
              >
                <span>{name}</span>
                <span style={{ fontSize: 10, color: "var(--text-faint)", marginLeft: "auto", whiteSpace: "nowrap" }}>
                  {relTime ?? (path.includes("/") ? path.split("/").slice(0, -1).join("/") : "")}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TrashPanel({ trashFiles, setTrashFiles, refreshTree, showToast }: {
  trashFiles: TrashFile[]; setTrashFiles: React.Dispatch<React.SetStateAction<TrashFile[]>>; refreshTree: () => void; showToast: (msg: string) => void;
}) {
  return (
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
        <div style={{ padding: 12, fontSize: 13, color: "var(--text-faint)" }}>Trash is empty</div>
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
                      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
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
                      method: "DELETE", credentials: "include",
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
  );
}
