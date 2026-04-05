import React, { useState, useEffect, useCallback, useRef } from "react";
import { FileTree } from "./components/FileTree.js";
import { Editor } from "./components/Editor.js";
import { Reader } from "./components/Reader.js";
import { Properties } from "./components/Properties.js";
import { Backlinks } from "./components/Backlinks.js";
import { QuickSwitcher } from "./components/QuickSwitcher.js";
import { SearchPanel } from "./components/SearchPanel.js";
import { Outline } from "./components/Outline.js";
import { CommandPalette } from "./components/CommandPalette.js";
import { ResizeHandle } from "./components/ResizeHandle.js";
import { Graph } from "./components/Graph.js";
import { CanvasView } from "./components/CanvasView.js";
import { Snippets } from "./components/Snippets.js";
import { Tags } from "./components/Tags.js";
import { LoginPage } from "./components/LoginPage.js";
import { Plugins } from "./components/Plugins.js";
import { StatusBar } from "./components/StatusBar.js";
import type { VaultEntry } from "./types.js";
import "./styles.css";
import "katex/dist/katex.min.css";
import "highlight.js/styles/github-dark.css";

type ViewMode = "edit" | "read";

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
}

interface Tab {
  id: string;
  path: string;
  content: string;
  mode: ViewMode;
  noteMeta: NoteMeta | null;
  backlinks: BacklinkEntry[];
  scrollTop: number;
  pinned?: boolean;
}

interface Pane {
  tabIds: string[];
  activeTabId: string | null;
}

let tabIdCounter = 0;
function nextTabId() {
  return `tab-${++tabIdCounter}`;
}

function ScrollContainer({ tabId, scrollTop, updateTab, children }: {
  tabId: string | null;
  scrollTop: number;
  updateTab: (id: string, patch: Partial<Tab>) => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const lastTabId = useRef<string | null>(null);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [progress, setProgress] = useState(0);

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
      setProgress(max > 0 ? el.scrollTop / max : 0);

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
        <div style={{ height: 2, flexShrink: 0, background: "#2a2a2a" }}>
          <div style={{
            height: "100%",
            width: `${progress * 100}%`,
            background: "#7f6df2",
            transition: "width 0.1s ease-out",
          }} />
        </div>
      )}
      <div ref={ref} style={{ flex: 1, overflow: "auto" }}>{children}</div>
    </div>
  );
}

function SidebarSection({ title, defaultOpen = true, children }: {
  title: string;
  defaultOpen?: boolean;
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
    <div style={{ borderTop: "1px solid #333" }}>
      <div
        onClick={toggle}
        style={{
          padding: "6px 12px",
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          color: "#666",
          letterSpacing: "0.5px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 4,
          userSelect: "none",
        }}
      >
        <span style={{
          display: "inline-block",
          fontSize: 8,
          transition: "transform 0.15s",
          transform: open ? "rotate(90deg)" : "rotate(0deg)",
        }}>▶</span>
        {title}
      </div>
      {open && children}
    </div>
  );
}

export function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState<string | null>(null);
  const [tree, setTree] = useState<VaultEntry[]>([]);
  const [tabsMap, setTabsMap] = useState<Record<string, Tab>>({});
  const [panes, setPanes] = useState<Pane[]>([{ tabIds: [], activeTabId: null }]);
  const [activePaneIdx, setActivePaneIdx] = useState(0);
  const [vaultName, setVaultName] = useState("Vault");
  const [error, setError] = useState<string | null>(null);
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [leftPanel, setLeftPanel] = useState<"files" | "search" | "plugins">("files");
  const [searchQuery, setSearchQuery] = useState("");
  const [readerHighlight, setReaderHighlight] = useState("");
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [leftWidth, setLeftWidth] = useState(260);
  const [rightWidth, setRightWidth] = useState(240);
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [showGraph, setShowGraph] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [tabCtxMenu, setTabCtxMenu] = useState<{ x: number; y: number; tabId: string; paneIdx: number } | null>(null);
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [cursorPos, setCursorPos] = useState<{ line: number; col: number; selectedChars: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2000);
  }, []);
  const splitDivRef = useRef<HTMLDivElement>(null);
  const dragTabRef = useRef<{ tabId: string; paneIdx: number } | null>(null);

  const activePane = panes[activePaneIdx];
  const activeTab = activePane?.activeTabId ? tabsMap[activePane.activeTabId] ?? null : null;
  const workspaceRestored = useRef(false);

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
    };
    const timeout = setTimeout(() => {
      try {
        localStorage.setItem("obsidian-web-workspace", JSON.stringify(snapshot));
      } catch {}
    }, 500);
    return () => clearTimeout(timeout);
  }, [tabsMap, panes, activePaneIdx, leftPanel, leftWidth, rightWidth, splitRatio]);

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
                      if (!d.error) updateTab(tabId, { content: d.content });
                    })
                    .catch(() => {});

                  if (tabPath.endsWith(".md")) {
                    fetch(`/api/vault/note?path=${encodeURIComponent(tabPath)}`, { credentials: "include" })
                      .then((r) => r.json())
                      .then((d) => { if (!d.error) updateTab(tabId, { noteMeta: d }); })
                      .catch(() => {});
                    fetch(`/api/vault/backlinks?path=${encodeURIComponent(tabPath)}`, { credentials: "include" })
                      .then((r) => r.json())
                      .then((d) => { if (!d.error) updateTab(tabId, { backlinks: d.backlinks }); })
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

  // Helper: update a specific tab in the map
  const updateTab = useCallback((id: string, patch: Partial<Tab>) => {
    setTabsMap((prev) => {
      const existing = prev[id];
      if (!existing) return prev;
      return { ...prev, [id]: { ...existing, ...patch } };
    });
  }, []);

  // Open a file in the active pane
  const openTab = useCallback(
    (path: string, targetPaneIdx?: number) => {
      setReaderHighlight("");
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
          scrollTop: 0,
        };

        setTabsMap((prev) => ({ ...prev, [id]: newTab }));

        // Load content
        fetch(`/api/vault/file?path=${encodeURIComponent(path)}`)
          .then((r) => r.json())
          .then((data) => {
            if (data.error) {
              setError(data.error);
            } else {
              updateTab(id, { content: data.content });
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
              if (!data.error) updateTab(id, { backlinks: data.backlinks });
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
      fetch(
        `/api/vault/resolve?target=${encodeURIComponent(target)}&from=${encodeURIComponent(from)}`,
      )
        .then((r) => r.json())
        .then((data) => {
          if (data.resolved) {
            openTab(data.resolved);
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
      fetch("/api/vault/file", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: activeTab.path, content }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.error) setError(data.error);
          else {
            setError(null);
            updateTab(activeTab.id, { content });
          }
        })
        .catch((e) => setError("Failed to save: " + e.message));
    },
    [activeTab, updateTab],
  );

  // Toggle mode for active tab
  const toggleMode = useCallback(() => {
    if (!activeTab) return;
    updateTab(activeTab.id, {
      mode: activeTab.mode === "edit" ? "read" : "edit",
    });
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
        // Switch to edit mode for the new note
        setTimeout(() => {
          setTabsMap((prev) => {
            const entry = Object.entries(prev).find(([, t]) => t.path === name);
            if (!entry) return prev;
            return { ...prev, [entry[0]]: { ...entry[1], mode: "edit" } };
          });
        }, 100);
      })
      .catch((e) => setError("Failed to create note: " + e.message));
  }, [tabsMap, refreshTree, openTab, showToast]);

  // Open or create today's daily note
  const openDailyNote = useCallback(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const path = `Daily Notes/${yyyy}-${mm}-${dd}.md`;

    // Try to open — if 404, create it first
    fetch(`/api/vault/file?path=${encodeURIComponent(path)}`, { credentials: "include" })
      .then((r) => {
        if (r.ok) {
          openTab(path);
        } else {
          const content = `# ${yyyy}-${mm}-${dd}\n\n`;
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

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault();
        createNewNote();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "d") {
        e.preventDefault();
        openDailyNote();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "o") {
        e.preventDefault();
        setShowSwitcher(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "f") {
        e.preventDefault();
        setLeftPanel((p) => (p === "search" ? "files" : "search"));
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "e") {
        e.preventDefault();
        toggleMode();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "p") {
        e.preventDefault();
        setShowCommandPalette(true);
      }
      // Ctrl+G: Toggle graph view
      if ((e.ctrlKey || e.metaKey) && e.key === "g") {
        e.preventDefault();
        setShowGraph((g) => !g);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "w") {
        e.preventDefault();
        if (activePane?.activeTabId) closeTab(activePane.activeTabId, activePaneIdx);
      }
      // Escape: close overlays
      if (e.key === "Escape") {
        if (showShortcuts) { setShowShortcuts(false); e.preventDefault(); return; }
      }
      // Ctrl+/: Show keyboard shortcuts
      if ((e.ctrlKey || e.metaKey) && e.key === "/") {
        e.preventDefault();
        setShowShortcuts((s) => !s);
      }
      // Ctrl+Tab / Ctrl+Shift+Tab: cycle tabs
      if ((e.ctrlKey || e.metaKey) && e.key === "Tab") {
        e.preventDefault();
        const tabIds = activePane?.tabIds ?? [];
        if (tabIds.length <= 1) return;
        const currentIdx = activePane?.activeTabId ? tabIds.indexOf(activePane.activeTabId) : 0;
        const delta = e.shiftKey ? -1 : 1;
        const nextIdx = (currentIdx + delta + tabIds.length) % tabIds.length;
        setPanes((prev) => {
          const next = [...prev];
          next[activePaneIdx] = { ...prev[activePaneIdx], activeTabId: tabIds[nextIdx] };
          return next;
        });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleMode, activePane, activePaneIdx, closeTab, createNewNote, openDailyNote, showShortcuts]);

  // Sync document title with active note
  useEffect(() => {
    const name = activeTab?.path.replace(/\.md$/, "").split("/").pop();
    document.title = name ? `${name} - ${vaultName || "Obsidian Web"}` : "Obsidian Web";
  }, [activeTab?.path, vaultName]);

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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#1e1e1e", color: "#666" }}>
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
          outline: isSplit && isActive ? "1px solid #7f6df2" : "none",
          outlineOffset: "-1px",
        }}
        onClick={() => setActivePaneIdx(paneIdx)}
      >
        {/* Pane tab bar */}
        {pane.tabIds.length > 0 && (
          <div
            className="tab-bar"
            onWheel={(e) => {
              e.currentTarget.scrollLeft += e.deltaY;
            }}
          >
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
                    if (!src || src.paneIdx !== paneIdx || src.tabId === tab.id) return;
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
                      style={{ background: "transparent", border: "1px solid #7f6df2", color: "#ddd", fontSize: 13, padding: "0 4px", borderRadius: 3, outline: "none", width: 120 }}
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
                        {tab.path.split("/").pop()?.replace(/\.md$/, "") ?? tab.path}
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
            {paneTab && paneIsMarkdown && (
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", paddingRight: 8 }}>
                <button
                  className="mode-toggle-btn"
                  title={paneTab.mode === "read" ? "Switch to editing view (Ctrl+E)" : "Switch to reading view (Ctrl+E)"}
                  onClick={() => updateTab(paneTab.id, { mode: paneTab.mode === "read" ? "edit" : "read" })}
                >
                  {paneTab.mode === "read" ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                      <path d="m15 5 4 4" />
                    </svg>
                  )}
                </button>
              </div>
            )}
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
              color: "#666",
              borderBottom: "1px solid #2a2a2a",
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
                    {i > 0 && <span style={{ color: "#444", margin: "0 2px" }}>›</span>}
                    <span
                      style={{
                        color: isLast ? "#999" : "#666",
                        cursor: isLast ? "default" : "pointer",
                        whiteSpace: "nowrap",
                      }}
                      onMouseEnter={(e) => { if (!isLast) (e.target as HTMLElement).style.color = "#bbb"; }}
                      onMouseLeave={(e) => { if (!isLast) (e.target as HTMLElement).style.color = "#666"; }}
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
        <ScrollContainer tabId={paneTab?.id ?? null} scrollTop={paneTab?.scrollTop ?? 0} updateTab={updateTab}>
          {paneTab ? (
            paneIsCanvas ? (
              <CanvasView
                content={paneTab.content}
                onNavigate={(path) => {
                  openTab(path);
                }}
              />
            ) : paneIsMarkdown && paneTab.mode === "read" ? (
              <Reader
                key={paneTab.path}
                content={paneTab.content}
                filePath={paneTab.path}
                onNavigate={handleNavigate}
                onSave={handleSave}
                searchHighlight={paneIdx === activePaneIdx ? readerHighlight : ""}
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
                onCursorChange={(info) => setCursorPos(info)}
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
              <div style={{ fontSize: 28, fontWeight: 300, color: "#555", letterSpacing: "-0.5px" }}>
                {vaultName}
              </div>
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
                      border: "1px solid #444",
                      borderRadius: 6,
                      background: "#2a2a2a",
                      color: "#999",
                      cursor: "pointer",
                      fontSize: 12,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 4,
                      minWidth: 110,
                    }}
                    onMouseEnter={(e) => {
                      (e.target as HTMLElement).style.borderColor = "#7f6df2";
                      (e.target as HTMLElement).style.color = "#ccc";
                    }}
                    onMouseLeave={(e) => {
                      (e.target as HTMLElement).style.borderColor = "#444";
                      (e.target as HTMLElement).style.color = "#999";
                    }}
                  >
                    <span>{item.label}</span>
                    <span style={{ fontSize: 10, color: "#555" }}>{item.shortcut}</span>
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: "#444" }}>
                Ctrl+/ for all shortcuts
              </div>
            </div>
          )}
        </ScrollContainer>
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
      {/* Left Sidebar */}
      <aside
        style={{
          width: leftWidth,
          minWidth: 140,
          borderRight: "1px solid #333",
          background: "#1e1e1e",
          color: "#ccc",
          display: "flex",
          flexDirection: "column",
          position: "relative",
        }}
      >
        <ResizeHandle side="left" onResize={handleLeftResize} />
        <div
          style={{
            padding: "8px 12px",
            borderBottom: "1px solid #333",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontWeight: 600, fontSize: 14 }}>{vaultName}</span>
          <div style={{ display: "flex", gap: 4 }}>
            <button
              onClick={() => setLeftPanel("files")}
              style={{
                padding: "2px 8px",
                border: "none",
                borderRadius: 3,
                background: leftPanel === "files" ? "#37373d" : "transparent",
                color: leftPanel === "files" ? "#ddd" : "#666",
                cursor: "pointer",
                fontSize: 11,
              }}
            >
              Files
            </button>
            <button
              onClick={() => setLeftPanel("search")}
              style={{
                padding: "2px 8px",
                border: "none",
                borderRadius: 3,
                background: leftPanel === "search" ? "#37373d" : "transparent",
                color: leftPanel === "search" ? "#ddd" : "#666",
                cursor: "pointer",
                fontSize: 11,
              }}
            >
              Search
            </button>
            <button
              onClick={() => setLeftPanel("plugins")}
              style={{
                padding: "2px 8px",
                border: "none",
                borderRadius: 3,
                background: leftPanel === "plugins" ? "#37373d" : "transparent",
                color: leftPanel === "plugins" ? "#ddd" : "#666",
                cursor: "pointer",
                fontSize: 11,
              }}
            >
              Plugins
            </button>
          </div>
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: leftPanel === "files" ? "8px 4px" : 0 }}>
          {leftPanel === "files" ? (
            tree.length > 0 ? (
              <FileTree
                entries={tree}
                onFileSelect={openTab}
                selectedPath={activeTab?.path ?? null}
                onMutate={refreshTree}
              />
            ) : (
              <div style={{ padding: 12, opacity: 0.5, fontSize: 13 }}>
                Loading...
              </div>
            )
          ) : leftPanel === "search" ? (
            <SearchPanel onNavigate={(path, q) => { openTab(path); if (q) setReaderHighlight(q); }} initialQuery={searchQuery} />
          ) : (
            <Plugins />
          )}
        </div>
      </aside>

      {/* Main content area */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          background: "#1e1e1e",
          color: "#ddd",
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
        {activeTab && (
          <StatusBar content={activeTab.content} path={activeTab.path} cursorPos={activeTab.mode === "edit" ? cursorPos : null} />
        )}
        </div>
      </div>

      {/* Right Sidebar */}
      {activeTab && isMarkdown && (
        <aside
          style={{
            width: rightWidth,
            minWidth: 140,
            borderLeft: "1px solid #333",
            background: "#1e1e1e",
            color: "#ccc",
            display: "flex",
            flexDirection: "column",
            overflow: "auto",
            position: "relative",
          }}
        >
          <ResizeHandle side="right" onResize={handleRightResize} />
          {activeTab.noteMeta && (
            <SidebarSection title="Properties">
              <Properties frontmatter={activeTab.noteMeta.frontmatter} />
            </SidebarSection>
          )}
          <SidebarSection title={`Backlinks (${activeTab.backlinks.length})`}>
            <Backlinks
              backlinks={activeTab.backlinks}
              onNavigate={openTab}
            />
          </SidebarSection>
          <SidebarSection title="Outline">
            <Outline content={activeTab.content} />
          </SidebarSection>
          <SidebarSection title="Tags">
            <Tags onNavigate={openTab} />
          </SidebarSection>
          <SidebarSection title="CSS Snippets">
            <Snippets />
          </SidebarSection>
        </aside>
      )}

      {/* Quick Switcher modal */}
      {showSwitcher && (
        <QuickSwitcher
          onSelect={openTab}
          onClose={() => setShowSwitcher(false)}
          recentPaths={[...new Set(Object.values(tabsMap).map((t) => t.path))]}
        />
      )}

      {/* Command Palette modal */}
      {showCommandPalette && (
        <CommandPalette
          commands={[
            {
              id: "new-note",
              name: "New Note",
              shortcut: "Ctrl+N",
              action: createNewNote,
            },
            {
              id: "daily-note",
              name: "Open Daily Note",
              shortcut: "Ctrl+D",
              action: openDailyNote,
            },
            {
              id: "toggle-mode",
              name: activeTab?.mode === "edit" ? "Switch to Read Mode" : "Switch to Edit Mode",
              shortcut: "Ctrl+E",
              action: toggleMode,
            },
            {
              id: "quick-switcher",
              name: "Open Quick Switcher",
              shortcut: "Ctrl+O",
              action: () => setShowSwitcher(true),
            },
            {
              id: "toggle-search",
              name: leftPanel === "search" ? "Show File Tree" : "Show Search",
              shortcut: "Ctrl+Shift+F",
              action: () => setLeftPanel((p) => (p === "search" ? "files" : "search")),
            },
            {
              id: "close-tab",
              name: "Close Active Tab",
              shortcut: "Ctrl+W",
              action: () => { if (activePane?.activeTabId) closeTab(activePane.activeTabId, activePaneIdx); },
            },
            {
              id: "toggle-graph",
              name: showGraph ? "Close Graph View" : "Open Graph View",
              shortcut: "Ctrl+G",
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
        />
      )}
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
              background: "#2a2a2a",
              border: "1px solid #444",
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
                  for (const tid of [...pane.tabIds]) closeTab(tid, tabCtxMenu.paneIdx);
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
                label: "Reveal in File Tree",
                action: () => setLeftPanel("files"),
              },
            ].map((item, i) =>
              "type" in item && item.type === "separator" ? (
                <div key={i} style={{ borderTop: "1px solid #444", margin: "4px 0" }} />
              ) : (
                <div
                  key={i}
                  style={{
                    padding: "6px 12px",
                    cursor: "pointer",
                    color: "#ccc",
                  }}
                  onMouseEnter={(e) => { (e.target as HTMLElement).style.background = "#37373d"; }}
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
              background: "#2a2a2a",
              border: "1px solid #444",
              borderRadius: 8,
              padding: "24px 32px",
              maxWidth: 480,
              width: "90%",
              maxHeight: "80vh",
              overflow: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 16, fontWeight: 600, color: "#ddd", marginBottom: 16 }}>
              Keyboard Shortcuts
            </div>
            {[
              ["Ctrl+N", "New note"],
              ["Ctrl+D", "Open daily note"],
              ["Ctrl+O", "Quick switcher"],
              ["Ctrl+P", "Command palette"],
              ["Ctrl+E", "Toggle read/edit mode"],
              ["Ctrl+W", "Close active tab"],
              ["Ctrl+Tab", "Next tab"],
              ["Ctrl+Shift+Tab", "Previous tab"],
              ["Ctrl+Shift+F", "Toggle search"],
              ["Ctrl+G", "Toggle graph view"],
              ["Ctrl+/", "Keyboard shortcuts"],
              ["Ctrl+F", "Find in editor"],
              ["Ctrl+B", "Bold"],
              ["Ctrl+I", "Italic"],
              ["Ctrl+K", "Insert link"],
            ].map(([key, desc]) => (
              <div
                key={key}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "6px 0",
                  borderBottom: "1px solid #333",
                }}
              >
                <span style={{ color: "#bbb", fontSize: 13 }}>{desc}</span>
                <kbd
                  style={{
                    background: "#1e1e1e",
                    border: "1px solid #555",
                    borderRadius: 4,
                    padding: "2px 8px",
                    fontSize: 12,
                    color: "#ccc",
                    fontFamily: "system-ui, monospace",
                    whiteSpace: "nowrap",
                  }}
                >
                  {key}
                </kbd>
              </div>
            ))}
            <div style={{ marginTop: 12, fontSize: 11, color: "#555", textAlign: "center" }}>
              Press Escape or Ctrl+/ to close
            </div>
          </div>
        </div>
      )}
      {/* Toast notification */}
      {toast && (
        <div style={{
          position: "fixed",
          bottom: 32,
          left: "50%",
          transform: "translateX(-50%)",
          background: "#333",
          color: "#ddd",
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
