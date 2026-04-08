import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { FileTree } from "./components/FileTree.js";
import { Editor } from "./components/Editor.js";
import { Reader } from "./components/Reader.js";
import { Properties } from "./components/Properties.js";
import { Backlinks } from "./components/Backlinks.js";
import { SearchPanel } from "./components/SearchPanel.js";
import { Outline } from "./components/Outline.js";
import { ResizeHandle } from "./components/ResizeHandle.js";
import { Graph } from "./components/Graph.js";
import { CanvasView } from "./components/CanvasView.js";
import { activateDemoMode } from "./demoApi.js";
import { RelatedNotes } from "./components/RelatedNotes.js";
import { recordWritingActivity } from "./components/WritingStreak.js";
import { Snippets } from "./components/Snippets.js";
import { Tags } from "./components/Tags.js";
import { Keywords } from "./components/Keywords.js";
import { LocalGraph } from "./components/LocalGraph.js";
import { LoginPage } from "./components/LoginPage.js";
import { Plugins } from "./components/Plugins.js";
import { StatusBar } from "./components/StatusBar.js";
import { saveSnapshot } from "./components/VersionHistory.js";
import { NoteGrowth } from "./components/NoteGrowth.js";
import { SidebarSection } from "./components/SidebarSection.js";
import { ScrollContainer } from "./components/ScrollContainer.js";
import { WordFrequency } from "./components/WordFrequency.js";
import { OutgoingLinks } from "./components/OutgoingLinks.js";
import { RightSidebar } from "./components/RightSidebar.js";
import { SharePage } from "./components/SharePage.js";
import { Ribbon } from "./components/Ribbon.js";
import { LeftSidebar } from "./components/LeftSidebar.js";
import { TabBar } from "./components/TabBar.js";
import { ModalOverlays } from "./components/ModalOverlays.js";
import { saveDraft, getDraft, clearDraft } from "./lib/recovery.js";
import { KanbanView } from "./components/KanbanView.js";
import { Minimap } from "./components/Minimap.js";
import { ErrorBoundary } from "./components/ErrorBoundary.js";
import { useToast } from "./hooks/useToast.js";
import { useAppSettings } from "./hooks/useAppSettings.js";
import { createMarkdownRenderer } from "./lib/markdown.js";
import { matchesCombo, getHotkey, loadHotkeyOverrides } from "./lib/hotkeys.js";
import type { VaultEntry } from "./types.js";
import { FM_RE, FRONTMATTER_TEMPLATES } from "./lib/frontmatter.js";
import type { ViewMode, NoteMeta, BacklinkEntry, UnlinkedMention, Tab, Pane } from "./lib/appTypes.js";
import "./styles.css";
import "katex/dist/katex.min.css";
import "highlight.js/styles/github-dark.css";

let tabIdCounter = 0;
function nextTabId() {
  return `tab-${++tabIdCounter}`;
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
  const [serverAvailable, setServerAvailable] = useState(true);
  const [tree, setTree] = useState<VaultEntry[]>([]);
  const vaultPaths = useMemo(() => {
    const paths: string[] = [];
    const walk = (es: VaultEntry[]) => {
      for (const e of es) {
        if (e.kind === "file") paths.push(e.path);
        else if (e.kind === "folder") walk(e.children);
      }
    };
    walk(tree);
    return paths;
  }, [tree]);
  const [backlinkCounts, setBacklinkCounts] = useState<Record<string, number>>({});
  const [todoCounts, setTodoCounts] = useState<Record<string, number>>({});
  const [gitStatus, setGitStatus] = useState<Record<string, string>>({});
  const [tabsMap, setTabsMap] = useState<Record<string, Tab>>({});
  const [panes, setPanes] = useState<Pane[]>([{ tabIds: [], activeTabId: null }]);
  const [activePaneIdx, setActivePaneIdx] = useState(0);
  const [vaultName, setVaultName] = useState("Vault");
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saveStatusTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [showQuickCapture, setShowQuickCapture] = useState(false);
  const [diffSource, setDiffSource] = useState<string | null>(null);
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
  const [editorInitialLine, setEditorInitialLine] = useState<number | null>(null);
  const [justSavedTabId, setJustSavedTabId] = useState<string | null>(null);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [leftWidth, setLeftWidth] = useState(260);
  const [rightWidth, setRightWidth] = useState(240);
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [syncScroll, setSyncScroll] = useState(false);
  const syncScrollRefs = useRef<(HTMLDivElement | null)[]>([null, null]);
  const syncScrollLock = useRef(false);
  const [showGraph, setShowGraph] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showWorkspaces, setShowWorkspaces] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showFmTemplates, setShowFmTemplates] = useState(false);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showMergePicker, setShowMergePicker] = useState(false);
  const [showVaultStats, setShowVaultStats] = useState(false);
  const [showBrokenLinks, setShowBrokenLinks] = useState(false);
  const calendarAnchorRef = useRef<HTMLButtonElement>(null);
  const { appSettings, setAppSettings, hotkeyMapRef, refreshHotkeyMap } = useAppSettings();

  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  const [leftCollapsed, setLeftCollapsed] = useState(() => window.innerWidth < 768);
  const [rightCollapsed, setRightCollapsed] = useState(() => window.innerWidth < 768);
  const [zenMode, setZenMode] = useState(false);
  useEffect(() => {
    document.documentElement.classList.toggle("zen-mode", zenMode);
  }, [zenMode]);
  const zenPrevState = useRef<{ left: boolean; right: boolean } | null>(null);
  const closedTabsStack = useRef<string[]>([]); // stack of file paths for undo close tab
  const closingTabs = useRef<Set<string>>(new Set()); // tabs currently animating closed
  const [tabCtxMenu, setTabCtxMenu] = useState<{ x: number; y: number; tabId: string; paneIdx: number } | null>(null);
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [cursorPos, setCursorPos] = useState<{ line: number; col: number; selectedChars: number; selectedWords?: number; selectedLines?: number; cursors?: number } | null>(null);
  const { toast, showToast } = useToast();
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

  // Inject custom CSS from settings
  useEffect(() => {
    let style = document.getElementById("user-custom-css") as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = "user-custom-css";
      document.head.appendChild(style);
    }
    style.textContent = appSettings.customCSS ?? "";
  }, [appSettings.customCSS]);

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
      .catch(() => {
        // No server available — activate demo mode with embedded vault
        activateDemoMode();
        setServerAvailable(false);
        setUser("demo");
        setAuthChecked(true);
      });
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
        // Fetch git status for file tree indicators
        fetch("/api/vault/git-status", { credentials: "include" })
          .then((r) => r.json())
          .then((data) => setGitStatus(data.files ?? {}))
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
              // Check for crash recovery draft
              getDraft(path).then((draft) => {
                if (draft && draft.timestamp > (data.modified ?? 0) && draft.content !== data.content) {
                  if (confirm(`Recovered unsaved changes for "${path.split("/").pop()}" from ${new Date(draft.timestamp).toLocaleTimeString()}. Restore?`)) {
                    updateTab(id, { content: draft.content, missing: false, dirty: true, fileCreated: data.created, fileModified: data.modified, fileSize: data.size });
                  } else {
                    updateTab(id, { content: data.content, missing: false, fileCreated: data.created, fileModified: data.modified, fileSize: data.size });
                    clearDraft(path);
                  }
                } else {
                  updateTab(id, { content: data.content, missing: false, fileCreated: data.created, fileModified: data.modified, fileSize: data.size });
                  if (draft) clearDraft(path);
                }
              }).catch(() => {
                updateTab(id, { content: data.content, missing: false, fileCreated: data.created, fileModified: data.modified, fileSize: data.size });
              });
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
  const removeTabFromState = useCallback(
    (tabId: string, paneIdx: number) => {
      closingTabs.current.delete(tabId);
      setPanes((prev) => {
        const pane = prev[paneIdx];
        if (!pane) return prev;
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

  const closeTab = useCallback(
    (tabId: string, paneIdx: number) => {
      // Confirm if tab has unsaved changes
      const tab = tabsMap[tabId];
      if (tab?.dirty) {
        const action = window.confirm(`"${tab.path.replace(/\.md$/, "").split("/").pop()}" has unsaved changes.\n\nDiscard changes?`);
        if (!action) return;
      }
      // Animate out, then remove
      closingTabs.current.add(tabId);
      // Switch active tab immediately if this is the active one
      setPanes((prev) => {
        const pane = prev[paneIdx];
        if (!pane || tabId !== pane.activeTabId) return prev;
        const idx = pane.tabIds.indexOf(tabId);
        const otherIds = pane.tabIds.filter((t) => t !== tabId);
        if (otherIds.length === 0) return prev;
        const newIdx = Math.min(idx, otherIds.length - 1);
        const next = [...prev];
        next[paneIdx] = { ...pane, activeTabId: otherIds[newIdx] };
        return next;
      });
      setTimeout(() => removeTabFromState(tabId, paneIdx), 200);
    },
    [tabsMap, removeTabFromState],
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
    (rawContent: string) => {
      if (!activeTab) return;
      const content = appSettings.trimTrailingWhitespace
        ? rawContent.split("\n").map((l) => l.trimEnd()).join("\n")
        : rawContent;
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
            setJustSavedTabId(activeTab.id);
            saveStatusTimer.current = setTimeout(() => { setSaveStatus("idle"); setJustSavedTabId(null); }, 2000);
            // Save version snapshot + clear recovery draft
            saveSnapshot(activeTab.path, content);
            clearDraft(activeTab.path);
            // Record writing activity for streak tracking
            const wc = content.split(/\s+/).filter(Boolean).length;
            recordWritingActivity(wc);
            window.dispatchEvent(new Event("websidian-save"));
          }
        })
        .catch((e) => {
          setError("Failed to save: " + e.message);
          setSaveStatus("idle");
        });
    },
    [activeTab, updateTab, appSettings.trimTrailingWhitespace],
  );

  const insertFrontmatterTemplate = useCallback((tpl: typeof FRONTMATTER_TEMPLATES[number]) => {
    if (!activeTab) return;
    const today = new Date().toISOString().slice(0, 10);
    const fields = tpl.fields.replace(/\{\{date\}\}/g, today);
    const content = activeTab.content;
    const m = FM_RE.exec(content);
    let newContent: string;
    if (m) {
      const existing = m[1];
      newContent = content.slice(0, m.index) + `---\n${existing}\n${fields}\n---\n` + content.slice(m.index + m[0].length);
    } else {
      newContent = `---\n${fields}\n---\n${content}`;
    }
    updateTab(activeTab.id, { content: newContent });
    handleSave(newContent);
    showToast(`Inserted "${tpl.name}" frontmatter`);
  }, [activeTab, updateTab, handleSave, showToast]);

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
    // Determine folder from currently active note
    const currentPath = activeTab?.path || "";
    const folder = currentPath.includes("/") ? currentPath.substring(0, currentPath.lastIndexOf("/")) : "";
    const prefix = folder ? `${folder}/` : "";

    // Find a unique name in that folder
    const existingPaths = new Set(Object.values(tabsMap).map((t) => t.path));
    let name = `${prefix}Untitled.md`;
    let i = 1;
    while (existingPaths.has(name)) {
      name = `${prefix}Untitled ${i}.md`;
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
  }, [tabsMap, activeTab, refreshTree, openTab, showToast]);

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

  // Periodic IndexedDB draft save for crash recovery
  useEffect(() => {
    const interval = setInterval(() => {
      for (const tab of Object.values(tabsMap)) {
        if (tab.dirty && tab.content && tab.path.endsWith(".md")) {
          saveDraft(tab.path, tab.content);
        }
      }
    }, 5000);
    return () => clearInterval(interval);
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
      const raw = hash.slice("#/note/".length);
      // Support heading anchors: #/note/path.md#heading-slug
      const hashIdx = raw.indexOf("#");
      const pathEncoded = hashIdx >= 0 ? raw.slice(0, hashIdx) : raw;
      const headingSlug = hashIdx >= 0 ? decodeURIComponent(raw.slice(hashIdx + 1)) : null;
      const path = decodeURIComponent(pathEncoded);
      if (path && path !== activeTab?.path) {
        openTab(path);
      }
      if (headingSlug) {
        setPendingHeading(headingSlug);
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
        {!zenMode && pane.tabIds.length > 0 && !(appSettings.autoHideTabBar && pane.tabIds.length === 1) && (
          <TabBar
            pane={pane}
            paneIdx={paneIdx}
            paneTab={paneTab}
            paneIsMarkdown={!!paneIsMarkdown}
            tabsMap={tabsMap}
            isMobile={isMobile}
            navIdx={navIdx}
            navHistory={navHistory}
            navIgnore={navIgnore}
            dragTabRef={dragTabRef}
            closingTabs={closingTabs}
            renamingTabId={renamingTabId}
            justSavedTabId={justSavedTabId}
            setPanes={setPanes}
            setActivePaneIdx={setActivePaneIdx}
            setTabsMap={setTabsMap}
            setLeftCollapsed={setLeftCollapsed}
            setRenamingTabId={setRenamingTabId}
            setTabCtxMenu={setTabCtxMenu}
            openTab={openTab}
            closeTab={closeTab}
            createNewNote={createNewNote}
            updateTab={updateTab}
            refreshTree={refreshTree}
            showToast={showToast}
          />
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
              // Find current heading hierarchy based on cursor position
              const headingPath: string[] = [];
              if (cursorPos && paneTab.mode !== "read" && paneTab.content) {
                const lines = paneTab.content.split("\n");
                const curLine = cursorPos.line;
                const stack: Array<{ level: number; text: string }> = [];
                for (let i = 0; i < Math.min(curLine, lines.length); i++) {
                  const hm = /^(#{1,6})\s+(.+)/.exec(lines[i]);
                  if (hm) {
                    const lvl = hm[1].length;
                    while (stack.length > 0 && stack[stack.length - 1].level >= lvl) stack.pop();
                    stack.push({ level: lvl, text: hm[2].replace(/[*_`~]/g, "").trim() });
                  }
                }
                stack.forEach((h) => headingPath.push(h.text));
              }
              return (
                <>
                  {segments.map((seg, i) => {
                    const isLast = i === segments.length - 1 && headingPath.length === 0;
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
                            if (!isLast) setLeftPanel("files");
                          }}
                        >
                          {seg}
                        </span>
                      </React.Fragment>
                    );
                  })}
                  {headingPath.map((h, i) => (
                    <React.Fragment key={`h${i}`}>
                      <span style={{ color: "var(--border-color)", margin: "0 2px" }}>›</span>
                      <span style={{ color: i === headingPath.length - 1 ? "var(--accent-color)" : "var(--text-faint)", whiteSpace: "nowrap", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}>{h}</span>
                    </React.Fragment>
                  ))}
                </>
              );
            })()}
          </div>
        )}

        {/* Pane content */}
        <ScrollContainer tabId={paneTab?.id ?? null} scrollTop={paneTab?.scrollTop ?? 0} updateTab={updateTab} mode={paneTab?.mode} className={!appSettings.readableLineLength ? "wide-mode" : undefined} noteContent={paneTab?.content} showMinimap={paneIsMarkdown && (paneTab?.content?.length ?? 0) > 1000} onProgressChange={paneIdx === activePaneIdx ? setScrollProgress : undefined} searchQuery={paneIdx === activePaneIdx ? readerHighlight : undefined} notePath={paneTab?.path} syncScrollRef={(el) => { syncScrollRefs.current[paneIdx] = el; }} onSyncScroll={syncScroll && isSplit ? (fraction) => { const otherIdx = paneIdx === 0 ? 1 : 0; const other = syncScrollRefs.current[otherIdx]; if (other && !syncScrollLock.current) { syncScrollLock.current = true; const max = other.scrollHeight - other.clientHeight; other.scrollTop = fraction * max; requestAnimationFrame(() => { syncScrollLock.current = false; }); } } : undefined} headings={paneIsMarkdown && paneTab?.mode === "read" && paneTab?.content ? (() => { const hs: Array<{ text: string; level: number; line: number }> = []; const lines = paneTab.content.split("\n"); let inFm = false; for (let i = 0; i < lines.length; i++) { if (i === 0 && lines[i].trim() === "---") { inFm = true; continue; } if (inFm && lines[i].trim() === "---") { inFm = false; continue; } if (inFm) continue; const hm = /^(#{1,6})\s+(.+)/.exec(lines[i]); if (hm) hs.push({ text: hm[2], level: hm[1].length, line: i }); } return hs; })() : undefined}>
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
          ) : paneTab && paneTab.content == null ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-faint)", fontSize: 13 }}>Loading...</div>
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
            ) : paneIsMarkdown && paneTab.mode === "kanban" ? (
              <KanbanView
                content={paneTab.content}
                onSave={(newContent) => handleSave(newContent)}
                onNavigate={handleNavigate}
              />
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
                onSwitchToEditor={(line) => {
                  setEditorInitialLine(line);
                  updateTab(paneTab.id, { mode: "edit" });
                  // Clear after editor has consumed the value
                  setTimeout(() => setEditorInitialLine(null), 500);
                }}
                backlinkCounts={backlinkCounts}
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
                rulerColumns={appSettings.rulerColumns}
                rainbowBrackets={appSettings.rainbowBrackets}
                cursorTrail={appSettings.cursorTrail}
                smartQuotes={appSettings.smartQuotes}
                sourceMode={paneTab.mode === "source"}
                scrollToHeadingRef={scrollToHeadingRef}
                foldAllRef={foldAllRef}
                backlinks={paneTab.backlinks}
                initialLine={editorInitialLine}
                initialCursorOffset={paneTab.cursorOffset}
                onCursorOffsetChange={(offset) => updateTab(paneTab.id, { cursorOffset: offset })}
                vaultPaths={vaultPaths}
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
      }}
    >
      {/* Ribbon + Left Sidebar */}
      <div style={{ display: "flex", height: "100%", flexShrink: 0 }}>
        {/* Obsidian-style icon ribbon */}
        {!(zenMode || isMobile) && (
          <Ribbon
            leftPanel={leftPanel}
            leftCollapsed={leftCollapsed}
            showGraph={showGraph}
            onPanelChange={setLeftPanel}
            onToggleCollapse={setLeftCollapsed}
            onToggleGraph={() => setShowGraph((g) => !g)}
            onToggleCalendar={() => setShowCalendar((c) => !c)}
            onToggleSettings={() => setShowSettings(true)}
            onRandomNote={openRandomNote}
            onRefreshTrash={refreshTrash}
            calendarAnchorRef={calendarAnchorRef}
          />
        )}

        <LeftSidebar
          leftPanel={leftPanel}
          leftCollapsed={leftCollapsed}
          leftWidth={leftWidth}
          isMobile={isMobile}
          setLeftCollapsed={setLeftCollapsed}
          setLeftWidth={setLeftWidth}
          setLeftPanel={setLeftPanel}
          handleLeftResize={handleLeftResize}
          tree={tree}
          activeTab={activeTab}
          activePaneIdx={activePaneIdx}
          panes={panes}
          openTab={openTab}
          refreshTree={refreshTree}
          handleFileRenamed={handleFileRenamed}
          duplicateNote={duplicateNote}
          createNewNote={createNewNote}
          setTabsMap={setTabsMap}
          setPanes={setPanes}
          updateTab={updateTab}
          nextTabId={nextTabId}
          searchQuery={searchQuery}
          setReaderHighlight={setReaderHighlight}
          setScrollToLine={setScrollToLine}
          starredNotes={starredNotes}
          toggleStar={toggleStar}
          recentFiles={recentFiles}
          trashFiles={trashFiles}
          setTrashFiles={setTrashFiles}
          backlinkCounts={backlinkCounts}
          todoCounts={todoCounts}
          gitStatus={gitStatus}
          showToast={showToast}
          showFileExtensions={appSettings.showFileExtensions}
          kbd={kbd}
        />
      </div>

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
                            rulerColumns={appSettings.rulerColumns}
                rainbowBrackets={appSettings.rainbowBrackets}
                cursorTrail={appSettings.cursorTrail}
                smartQuotes={appSettings.smartQuotes}
                            sourceMode={tab.mode === "source"}
                            initialCursorOffset={tab.cursorOffset}
                            onCursorOffsetChange={(offset) => updateTab(tabId, { cursorOffset: offset })}
                            vaultPaths={vaultPaths}
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
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <div
                      ref={splitDivRef}
                      className="split-divider"
                      onMouseDown={handleSplitDrag}
                    />
                    <button
                      title={syncScroll ? "Disable sync scroll" : "Enable sync scroll"}
                      onClick={() => setSyncScroll((s) => !s)}
                      style={{
                        position: "absolute",
                        top: 4,
                        left: "50%",
                        transform: "translateX(-50%)",
                        zIndex: 20,
                        width: 20,
                        height: 20,
                        borderRadius: 3,
                        border: "1px solid var(--border-color)",
                        background: syncScroll ? "var(--accent-color)" : "var(--bg-tertiary)",
                        color: syncScroll ? "#fff" : "var(--text-faint)",
                        cursor: "pointer",
                        fontSize: 10,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 0,
                        lineHeight: 1,
                      }}
                    >
                      ⇅
                    </button>
                  </div>
                )}
                {renderPaneContent(pane, idx)}
              </React.Fragment>
            ))
          )}
        </div>

        {/* Status bar */}
        {!zenMode && activeTab && (
          <StatusBar content={activeTab.content} path={activeTab.path} cursorPos={activeTab.mode !== "read" ? cursorPos : null} saveStatus={saveStatus} fileCreated={activeTab.fileCreated} fileModified={activeTab.fileModified} scrollProgress={activeTab.mode === "read" ? scrollProgress : undefined} lineWrap={activeTab.mode !== "read" ? appSettings.lineWrap : undefined} onToggleLineWrap={activeTab.mode !== "read" ? () => setAppSettings((s) => ({ ...s, lineWrap: !s.lineWrap })) : undefined} />
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
      <RightSidebar
        activeTab={activeTab}
        isMarkdown={!!isMarkdown}
        rightWidth={rightWidth}
        rightCollapsed={rightCollapsed}
        isMobile={isMobile}
        headingNumbers={appSettings.headingNumbers}
        onRightResize={handleRightResize}
        onOpenTab={openTab}
        onNavigate={handleNavigate}
        onSave={handleSave}
        onUpdateTab={updateTab}
        onShowToast={showToast}
        onSetLeftPanel={setLeftPanel}
        onSetLeftCollapsed={setLeftCollapsed}
        onSetSearchQuery={setSearchQuery}
        scrollToHeadingRef={scrollToHeadingRef}
        tree={tree}
      />

      {/* Quick Switcher modal */}
      <ModalOverlays
        showSwitcher={showSwitcher}
        showQuickCapture={showQuickCapture}
        showCommandPalette={showCommandPalette}
        showTemplatePicker={showTemplatePicker}
        showFmTemplates={showFmTemplates}
        showShortcuts={showShortcuts}
        showSettings={showSettings}
        showVaultStats={showVaultStats}
        showBrokenLinks={showBrokenLinks}
        showMergePicker={showMergePicker}
        showVersionHistory={showVersionHistory}
        showCalendar={showCalendar}
        showWorkspaces={showWorkspaces}
        showFolderPicker={showFolderPicker}
        showGraph={showGraph}
        diffSource={diffSource}
        tabCtxMenu={tabCtxMenu}
        toast={toast}
        activeTab={activeTab}
        activePane={activePane}
        activePaneIdx={activePaneIdx}
        panes={panes}
        tabsMap={tabsMap}
        tree={tree}
        appSettings={appSettings}
        starredNotes={starredNotes}
        leftPanel={leftPanel}
        leftWidth={leftWidth}
        rightWidth={rightWidth}
        splitRatio={splitRatio}
        leftCollapsed={leftCollapsed}
        rightCollapsed={rightCollapsed}
        zenMode={zenMode}
        syncScroll={syncScroll}
        user={user}
        calendarAnchorRef={calendarAnchorRef}
        closedTabsStack={closedTabsStack}
        foldAllRef={foldAllRef}
        setShowSwitcher={setShowSwitcher}
        setShowQuickCapture={setShowQuickCapture}
        setShowCommandPalette={setShowCommandPalette}
        setShowTemplatePicker={setShowTemplatePicker}
        setShowFmTemplates={setShowFmTemplates}
        setShowShortcuts={setShowShortcuts}
        setShowSettings={setShowSettings}
        setShowVaultStats={setShowVaultStats}
        setShowBrokenLinks={setShowBrokenLinks}
        setShowMergePicker={setShowMergePicker}
        setShowVersionHistory={setShowVersionHistory}
        setShowCalendar={setShowCalendar}
        setShowWorkspaces={setShowWorkspaces}
        setShowFolderPicker={setShowFolderPicker}
        setShowGraph={setShowGraph}
        setDiffSource={setDiffSource}
        setTabCtxMenu={setTabCtxMenu}
        setLeftPanel={setLeftPanel}
        setLeftCollapsed={setLeftCollapsed}
        setRightCollapsed={setRightCollapsed}
        setAppSettings={setAppSettings}
        setPanes={setPanes}
        setTabsMap={setTabsMap}
        setSyncScroll={setSyncScroll}
        setUser={setUser}
        setTree={setTree}
        setActivePaneIdx={setActivePaneIdx}
        setLeftWidth={setLeftWidth}
        setRightWidth={setRightWidth}
        setSplitRatio={setSplitRatio}
        openTab={openTab}
        closeTab={closeTab}
        updateTab={updateTab}
        handleSave={handleSave}
        handleFileRenamed={handleFileRenamed}
        refreshTree={refreshTree}
        refreshHotkeyMap={refreshHotkeyMap}
        showToast={showToast}
        createNewNote={createNewNote}
        openDailyNote={openDailyNote}
        openDailyByDate={openDailyByDate}
        openRandomNote={openRandomNote}
        toggleMode={toggleMode}
        toggleZenMode={toggleZenMode}
        toggleStar={toggleStar}
        exportAsHtml={exportAsHtml}
        splitRight={splitRight}
        closeSplit={closeSplit}
        duplicateNote={duplicateNote}
        mergeNoteInto={mergeNoteInto}
        insertFrontmatterTemplate={insertFrontmatterTemplate}
        nextTabId={nextTabId}
      />

    </div>
  );
}
