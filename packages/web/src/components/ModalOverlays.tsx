import React from "react";
import type { Tab, Pane, ViewMode } from "../lib/appTypes.js";
import type { VaultEntry } from "../types.js";
import type { AppSettings } from "./Settings.js";
import { QuickSwitcher } from "./QuickSwitcher.js";
import { DiffView } from "./DiffView.js";
import { QuickCapture } from "./QuickCapture.js";
import { CommandPalette } from "./CommandPalette.js";
import { TabContextMenu } from "./TabContextMenu.js";
import { TemplatePicker } from "./TemplatePicker.js";
import { ShortcutsOverlay } from "./ShortcutsOverlay.js";
import { Settings } from "./Settings.js";
import { VaultStats } from "./VaultStats.js";
import { BrokenLinkReport } from "./BrokenLinkReport.js";
import { VersionHistory } from "./VersionHistory.js";
import { Calendar } from "./Calendar.js";
import { WorkspaceManager } from "./WorkspaceManager.js";
import { FolderPicker } from "./FolderPicker.js";
import { WelcomeTour } from "./WelcomeTour.js";
import { FRONTMATTER_TEMPLATES } from "../lib/frontmatter.js";
import { getCommandPaletteCommands } from "../lib/commandPaletteCommands.js";
import { isDemoMode } from "../demoApi.js";

interface ModalOverlaysProps {
  // Visibility flags
  showSwitcher: boolean;
  showQuickCapture: boolean;
  showCommandPalette: boolean;
  showTemplatePicker: boolean;
  showFmTemplates: boolean;
  showShortcuts: boolean;
  showSettings: boolean;
  showVaultStats: boolean;
  showBrokenLinks: boolean;
  showMergePicker: boolean;
  showVersionHistory: boolean;
  showCalendar: boolean;
  showWorkspaces: boolean;
  showFolderPicker: boolean;
  showGraph: boolean;
  diffSource: string | null;
  tabCtxMenu: { x: number; y: number; tabId: string; paneIdx: number } | null;
  toast: string | null;
  // Data
  activeTab: Tab | null;
  activePane: Pane | null;
  activePaneIdx: number;
  panes: Pane[];
  tabsMap: Record<string, Tab>;
  tree: VaultEntry[];
  appSettings: AppSettings;
  starredNotes: string[];
  leftPanel: "files" | "search" | "plugins" | "starred" | "recent" | "trash";
  leftWidth: number;
  rightWidth: number;
  splitRatio: number;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  zenMode: boolean;
  syncScroll: boolean;
  user: string | null;
  calendarAnchorRef: React.RefObject<HTMLButtonElement | null>;
  closedTabsStack: React.MutableRefObject<string[]>;
  foldAllRef: React.MutableRefObject<{ foldAll: () => void; unfoldAll: () => void } | null>;
  // Setters
  setShowSwitcher: (v: boolean) => void;
  setShowQuickCapture: (v: boolean) => void;
  setShowCommandPalette: (v: boolean) => void;
  setShowTemplatePicker: (v: boolean) => void;
  setShowFmTemplates: (v: boolean) => void;
  setShowShortcuts: (v: boolean | ((prev: boolean) => boolean)) => void;
  setShowSettings: (v: boolean | ((prev: boolean) => boolean)) => void;
  setShowVaultStats: (v: boolean) => void;
  setShowBrokenLinks: (v: boolean) => void;
  setShowMergePicker: (v: boolean) => void;
  setShowVersionHistory: (v: boolean) => void;
  setShowCalendar: (v: boolean) => void;
  setShowWorkspaces: (v: boolean) => void;
  setShowFolderPicker: (v: boolean) => void;
  setShowGraph: React.Dispatch<React.SetStateAction<boolean>>;
  setDiffSource: (v: string | null) => void;
  setTabCtxMenu: (v: { x: number; y: number; tabId: string; paneIdx: number } | null) => void;
  setLeftPanel: React.Dispatch<React.SetStateAction<"files" | "search" | "plugins" | "starred" | "recent" | "trash">>;
  setLeftCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  setRightCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  setAppSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  setPanes: React.Dispatch<React.SetStateAction<Pane[]>>;
  setTabsMap: React.Dispatch<React.SetStateAction<Record<string, Tab>>>;
  setSyncScroll: React.Dispatch<React.SetStateAction<boolean>>;
  setUser: React.Dispatch<React.SetStateAction<string | null>>;
  setTree: React.Dispatch<React.SetStateAction<VaultEntry[]>>;
  setActivePaneIdx: (v: number) => void;
  setLeftWidth: (v: number) => void;
  setRightWidth: (v: number) => void;
  setSplitRatio: (v: number) => void;
  // Callbacks
  openTab: (path: string) => void;
  closeTab: (tabId: string, paneIdx: number) => void;
  updateTab: (id: string, patch: Partial<Tab>) => void;
  handleSave: (content: string) => void;
  handleFileRenamed: (from: string, to: string, updatedFiles: string[]) => void;
  refreshTree: () => void;
  refreshHotkeyMap: () => void;
  showToast: (msg: string) => void;
  createNewNote: () => void;
  openDailyNote: () => void;
  openDailyByDate: (dateStr: string) => void;
  openRandomNote: () => void;
  toggleMode: () => void;
  toggleZenMode: () => void;
  toggleStar: (path: string) => void;
  exportAsHtml: () => void;
  splitRight: () => void;
  closeSplit: () => void;
  duplicateNote: (path: string) => void;
  mergeNoteInto: (path: string) => void;
  insertFrontmatterTemplate: (tpl: typeof FRONTMATTER_TEMPLATES[number]) => void;
  nextTabId: () => string;
}

export function ModalOverlays(props: ModalOverlaysProps) {
  const {
    showSwitcher, showQuickCapture, showCommandPalette, showTemplatePicker,
    showFmTemplates, showShortcuts, showSettings, showVaultStats, showBrokenLinks,
    showMergePicker, showVersionHistory, showCalendar, showWorkspaces, showFolderPicker,
    diffSource, tabCtxMenu, toast, activeTab, activePane, activePaneIdx, panes,
    tabsMap, tree, appSettings, starredNotes, leftPanel, leftWidth, rightWidth,
    splitRatio, leftCollapsed, rightCollapsed, zenMode, syncScroll, showGraph, user,
    calendarAnchorRef, closedTabsStack, foldAllRef,
    setShowSwitcher, setShowQuickCapture, setShowCommandPalette, setShowTemplatePicker,
    setShowFmTemplates, setShowShortcuts, setShowSettings, setShowVaultStats,
    setShowBrokenLinks, setShowMergePicker, setShowVersionHistory, setShowCalendar,
    setShowWorkspaces, setShowFolderPicker, setShowGraph, setDiffSource, setTabCtxMenu,
    setLeftPanel, setLeftCollapsed, setRightCollapsed, setAppSettings, setPanes,
    setTabsMap, setSyncScroll, setUser, setTree, setActivePaneIdx,
    setLeftWidth, setRightWidth, setSplitRatio,
    openTab, closeTab, updateTab, handleSave, handleFileRenamed, refreshTree,
    refreshHotkeyMap, showToast, createNewNote, openDailyNote, openDailyByDate,
    openRandomNote, toggleMode, toggleZenMode, toggleStar, exportAsHtml,
    splitRight, closeSplit, duplicateNote, mergeNoteInto, insertFrontmatterTemplate,
    nextTabId,
  } = props;

  return (
    <>
      {/* Quick Switcher */}
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

      {/* Diff View */}
      {diffSource && (
        <DiffView diffSource={diffSource} tree={tree} onClose={() => setDiffSource(null)} />
      )}

      {/* Quick Capture */}
      {showQuickCapture && (
        <QuickCapture
          onClose={() => setShowQuickCapture(false)}
          onSave={(path, content) => {
            fetch("/api/vault/file", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ path, content }),
            }).then(() => {
              refreshTree();
              openTab(path);
              showToast(`Captured to ${path}`);
              setShowQuickCapture(false);
            }).catch(() => showToast("Failed to save"));
          }}
        />
      )}

      {/* Command Palette */}
      {showCommandPalette && <CommandPalette
        commands={getCommandPaletteCommands({
          activeTab, activePane, activePaneIdx, panes,
          leftPanel, leftCollapsed, rightCollapsed, zenMode, showGraph, syncScroll,
          appSettings, user,
          closedTabsStack, foldAllRef,
          setShowSwitcher, setShowGraph, setShowSettings, setShowTemplatePicker,
          setShowFmTemplates, setShowWorkspaces, setShowQuickCapture,
          setShowVersionHistory, setShowMergePicker, setShowVaultStats,
          setShowBrokenLinks, setShowFolderPicker,
          setLeftPanel, setLeftCollapsed, setRightCollapsed, setAppSettings,
          setPanes, setTabsMap, setSyncScroll, setUser, setTree,
          createNewNote, openDailyNote, toggleMode, closeTab, openTab,
          updateTab, handleSave, toggleZenMode, openRandomNote, exportAsHtml,
          splitRight, closeSplit, refreshTree, showToast,
        })}
        onClose={() => setShowCommandPalette(false)}
      />}

      {/* Tab Context Menu */}
      {tabCtxMenu && (
        <TabContextMenu
          x={tabCtxMenu.x}
          y={tabCtxMenu.y}
          tabId={tabCtxMenu.tabId}
          paneIdx={tabCtxMenu.paneIdx}
          tabsMap={tabsMap}
          panes={panes}
          starredNotes={starredNotes}
          onClose={() => setTabCtxMenu(null)}
          onUpdateTab={updateTab}
          onCloseTab={closeTab}
          onOpenTab={openTab}
          onSetPanes={setPanes}
          onSetTabsMap={setTabsMap}
          onSetLeftPanel={setLeftPanel}
          onToggleStar={toggleStar}
          onDuplicateNote={duplicateNote}
          onSetDiffSource={setDiffSource}
          onShowToast={showToast}
          nextTabId={nextTabId}
        />
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
            const now = new Date();
            const title = activeTab.path.replace(/\.md$/, "").split("/").pop() ?? "";
            const content = data.content
              .replace(/\{\{date\}\}/g, `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`)
              .replace(/\{\{time\}\}/g, `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`)
              .replace(/\{\{title\}\}/g, title);
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

      {/* Frontmatter Templates */}
      {showFmTemplates && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 10000, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 120 }}
          onClick={() => setShowFmTemplates(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--bg-secondary)", border: "1px solid var(--border-color)",
              borderRadius: 8, padding: 12, minWidth: 260, boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            }}
          >
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8, fontWeight: 600 }}>Insert Frontmatter Template</div>
            {FRONTMATTER_TEMPLATES.map((tpl) => (
              <div
                key={tpl.name}
                onClick={() => { insertFrontmatterTemplate(tpl); setShowFmTemplates(false); }}
                style={{
                  padding: "6px 10px", borderRadius: 4, cursor: "pointer", fontSize: 13,
                  color: "var(--text-primary)",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--bg-tertiary)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                {tpl.name}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts */}
      {showShortcuts && <ShortcutsOverlay onClose={() => setShowShortcuts(false)} />}

      {/* Settings */}
      {showSettings && (
        <Settings
          settings={appSettings}
          onUpdate={setAppSettings}
          onClose={() => { setShowSettings(false); refreshHotkeyMap(); }}
        />
      )}

      {/* Vault Stats */}
      {showVaultStats && (
        <VaultStats
          onClose={() => setShowVaultStats(false)}
          onNavigate={openTab}
        />
      )}

      {/* Broken Links */}
      {showBrokenLinks && (
        <BrokenLinkReport
          onClose={() => setShowBrokenLinks(false)}
          onNavigate={openTab}
          onCreateNote={(title) => {
            const path = `${title}.md`;
            fetch("/api/vault/file", {
              method: "PUT",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ path, content: `# ${title}\n` }),
            }).then(() => openTab(path)).catch(() => {});
          }}
        />
      )}

      {/* Merge Picker */}
      {showMergePicker && activeTab && (
        <QuickSwitcher
          onSelect={(path) => {
            setShowMergePicker(false);
            mergeNoteInto(path);
          }}
          onClose={() => setShowMergePicker(false)}
        />
      )}

      {/* Version History */}
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

      {/* Calendar */}
      {showCalendar && (
        <Calendar
          anchorRect={calendarAnchorRef.current?.getBoundingClientRect() ?? null}
          onSelectDate={(dateStr) => openDailyByDate(dateStr)}
          onClose={() => setShowCalendar(false)}
        />
      )}

      {/* Workspace Manager */}
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
            const newTabsMap: Record<string, Tab> = {};
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

      {/* Folder Picker for Move file */}
      {showFolderPicker && activeTab && (() => {
        const collectFolders = (entries: VaultEntry[], _prefix = ""): string[] => {
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
          animation: "toast-slide-up 0.25s cubic-bezier(0.22, 1, 0.36, 1)",
        }}>
          {toast}
        </div>
      )}

      {isDemoMode() && <WelcomeTour />}
    </>
  );
}
