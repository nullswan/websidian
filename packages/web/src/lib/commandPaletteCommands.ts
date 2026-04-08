import type { Tab, Pane } from "./appTypes.js";
import type { AppSettings } from "../components/Settings.js";
import type { VaultEntry } from "../types.js";
import { loadHotkeyOverrides, getHotkey } from "./hotkeys.js";
import { createMarkdownRenderer } from "./markdown.js";
import { updateFrontmatterField, deleteFrontmatterField, addFrontmatterField } from "./frontmatter.js";
import { isDemoMode, resetDemoVault } from "../demoApi.js";

interface Command {
  id: string;
  name: string;
  shortcut?: string;
  action: () => void;
}

export interface CommandContext {
  // Current state
  activeTab: Tab | null;
  activePane: Pane | null;
  activePaneIdx: number;
  panes: Pane[];
  leftPanel: string;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  zenMode: boolean;
  showGraph: boolean;
  syncScroll: boolean;
  appSettings: AppSettings;
  user: string | null;

  // Refs
  closedTabsStack: React.MutableRefObject<string[]>;
  foldAllRef: React.MutableRefObject<{ foldAll: () => void; unfoldAll: () => void } | null>;

  // State setters
  setShowSwitcher: (v: boolean) => void;
  setShowGraph: React.Dispatch<React.SetStateAction<boolean>>;
  setShowSettings: (v: boolean) => void;
  setShowTemplatePicker: (v: boolean) => void;
  setShowFmTemplates: (v: boolean) => void;
  setShowWorkspaces: (v: boolean) => void;
  setShowQuickCapture: (v: boolean) => void;
  setShowVersionHistory: (v: boolean) => void;
  setShowMergePicker: (v: boolean) => void;
  setShowVaultStats: (v: boolean) => void;
  setShowBrokenLinks: (v: boolean) => void;
  setShowFolderPicker: (v: boolean) => void;
  setLeftPanel: React.Dispatch<React.SetStateAction<"files" | "search" | "plugins" | "starred" | "recent" | "trash">>;
  setLeftCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  setRightCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  setAppSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  setPanes: React.Dispatch<React.SetStateAction<Pane[]>>;
  setTabsMap: React.Dispatch<React.SetStateAction<Record<string, Tab>>>;
  setSyncScroll: React.Dispatch<React.SetStateAction<boolean>>;
  setUser: (v: string | null) => void;
  setTree: React.Dispatch<React.SetStateAction<VaultEntry[]>>;

  // Callbacks
  createNewNote: () => void;
  openDailyNote: () => void;
  toggleMode: () => void;
  closeTab: (tabId: string, paneIdx: number) => void;
  openTab: (path: string, paneIdx?: number) => void;
  updateTab: (id: string, patch: Partial<Tab>) => void;
  handleSave: (content: string) => void;
  toggleZenMode: () => void;
  openRandomNote: () => void;
  exportAsHtml: () => void;
  splitRight: () => void;
  closeSplit: () => void;
  refreshTree: () => void;
  showToast: (msg: string) => void;
}

export function getCommandPaletteCommands(ctx: CommandContext): Command[] {
  const hko = loadHotkeyOverrides();
  const hk = (id: string) => getHotkey(id, hko);

  const {
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
  } = ctx;

  const commands: Command[] = [
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
        import("../components/Settings.js").then(({ saveSettings }) => saveSettings(next));
      },
    },
    {
      id: "insert-template",
      name: "Insert template",
      action: () => setShowTemplatePicker(true),
    },
    {
      id: "insert-frontmatter-template",
      name: "Insert frontmatter template",
      action: () => setShowFmTemplates(true),
    },
    {
      id: "set-word-goal",
      name: "Set word count goal",
      action: () => {
        if (!activeTab) return;
        const current = activeTab.content.match(/wordGoal:\s*(\d+)/i)?.[1] ?? "";
        const val = prompt("Word count goal:", current);
        if (val === null) return;
        const num = parseInt(val, 10);
        if (isNaN(num) || num < 0) { showToast("Invalid number"); return; }
        let updated: string;
        if (num === 0) {
          updated = deleteFrontmatterField(activeTab.content, "wordGoal");
        } else {
          updated = activeTab.content.match(/wordGoal:/i)
            ? updateFrontmatterField(activeTab.content, "wordGoal", String(num))
            : addFrontmatterField(activeTab.content, "wordGoal", String(num));
        }
        updateTab(activeTab.id, { content: updated });
        handleSave(updated);
        showToast(num > 0 ? `Word goal set to ${num}` : "Word goal removed");
      },
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
      id: "quick-capture",
      name: "Quick capture note",
      action: () => setShowQuickCapture(true),
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
      id: "share-note",
      name: "Share note as URL",
      action: async () => {
        if (!activeTab?.content) { showToast("No active note"); return; }
        const title = activeTab.path.replace(/\.md$/, "").split("/").pop() || "Untitled";
        const payload = JSON.stringify({ t: title, c: activeTab.content });
        try {
          const stream = new Blob([payload]).stream().pipeThrough(new CompressionStream("gzip"));
          const compressed = await new Response(stream).arrayBuffer();
          const b64 = btoa(String.fromCharCode(...new Uint8Array(compressed)))
            .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
          const url = `${window.location.origin}${window.location.pathname}#/share/${b64}`;
          await navigator.clipboard.writeText(url);
          showToast("Share URL copied to clipboard");
        } catch {
          const b64 = btoa(unescape(encodeURIComponent(payload)))
            .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
          const url = `${window.location.origin}${window.location.pathname}#/share/${b64}`;
          navigator.clipboard.writeText(url).then(() => showToast("Share URL copied to clipboard"));
        }
      },
    },
    {
      id: "version-history",
      name: "Version history",
      action: () => { if (activeTab) setShowVersionHistory(true); },
    },
    {
      id: "kanban-view",
      name: "Toggle kanban board view",
      action: () => {
        if (!activeTab) return;
        const next = activeTab.mode === "kanban" ? "read" : "kanban";
        updateTab(activeTab.id, { mode: next });
      },
    },
    {
      id: "split-preview",
      name: "Split preview (editor + reader side-by-side)",
      action: () => {
        if (!activeTab) return;
        if (panes.length >= 2) {
          showToast("Already in split view");
          return;
        }
        updateTab(activeTab.id, { mode: "edit" });
        setPanes((prev) => [...prev, { tabIds: [], activeTabId: null }]);
        setTimeout(() => {
          openTab(activeTab.path, panes.length);
          setTimeout(() => {
            setTabsMap((prev) => {
              const newTabEntry = Object.entries(prev).find(
                ([id, t]) => t.path === activeTab.path && id !== activeTab.id
              );
              if (newTabEntry) {
                return { ...prev, [newTabEntry[0]]: { ...newTabEntry[1], mode: "read" } };
              }
              return prev;
            });
          }, 100);
        }, 0);
      },
    },
    {
      id: "rename-tag",
      name: "Rename tag across vault",
      action: async () => {
        const oldTag = window.prompt("Current tag (e.g. #old-tag):");
        if (!oldTag?.trim()) return;
        const newTag = window.prompt(`Rename "${oldTag.trim()}" to:`);
        if (!newTag?.trim()) return;
        const from = oldTag.trim().startsWith("#") ? oldTag.trim() : `#${oldTag.trim()}`;
        const to = newTag.trim().startsWith("#") ? newTag.trim() : `#${newTag.trim()}`;
        try {
          const res = await fetch("/api/vault/search-replace", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ query: from, replace: to, caseSensitive: true }),
          });
          const data = await res.json();
          if (data.totalReplacements > 0) {
            showToast(`Renamed ${from} to ${to} in ${data.changedFiles?.length ?? 0} files (${data.totalReplacements} occurrences)`);
            refreshTree();
            if (activeTab) {
              fetch(`/api/vault/file?path=${encodeURIComponent(activeTab.path)}`, { credentials: "include" })
                .then((r) => r.json())
                .then((d) => { if (!d.error) updateTab(activeTab.id, { content: d.content }); });
            }
          } else {
            showToast(`No occurrences of ${from} found`);
          }
        } catch {
          showToast("Tag rename failed");
        }
      },
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
      id: "broken-links",
      name: "Scan for broken links",
      action: () => setShowBrokenLinks(true),
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
        if (activeTab?.mode !== "edit") {
          showToast("Switch to edit mode and select text first");
        } else {
          showToast("Select text in the editor, then press Ctrl+Shift+N");
        }
      },
    },
    {
      id: "split-at-heading",
      name: "Split note at heading\u2026",
      action: () => {
        if (!activeTab) return;
        const content = activeTab.content;
        const lines = content.split("\n");
        const headings: Array<{ text: string; level: number; lineIdx: number }> = [];
        const fmMatch = /^---[\t ]*\r?\n[\s\S]*?\n---[\t ]*(?:\r?\n|$)/.exec(content);
        const fmLines = fmMatch ? fmMatch[0].split("\n").length - 1 : 0;
        for (let i = fmLines; i < lines.length; i++) {
          const m = /^(#{1,6})\s+(.+)$/.exec(lines[i]);
          if (m) headings.push({ text: m[2].trim(), level: m[1].length, lineIdx: i });
        }
        if (headings.length < 2) { showToast("Need at least 2 headings to split"); return; }
        const splitIdx = headings[1].lineIdx;
        const splitHeading = headings[1].text;
        const before = lines.slice(0, splitIdx).join("\n").trimEnd();
        const after = lines.slice(splitIdx).join("\n");
        const newName = splitHeading.replace(/[/\\:*?"<>|]/g, "").trim();
        const dir = activeTab.path.split("/").slice(0, -1).join("/");
        const newPath = dir ? `${dir}/${newName}.md` : `${newName}.md`;
        const updatedContent = before + "\n\n[[" + newName + "]]\n";
        updateTab(activeTab.id, { content: updatedContent, dirty: true });
        fetch(`/api/vault/note?path=${encodeURIComponent(activeTab.path)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ content: updatedContent }),
        }).catch(() => {});
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
        const updated = activeTab.content.replace(
          new RegExp(`^(#{1,6})\\s+${oldHeading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "m"),
          `$1 ${newHeading}`,
        );
        updateTab(activeTab.id, { content: updated, dirty: true });
        fetch(`/api/vault/note?path=${encodeURIComponent(activeTab.path)}`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
          body: JSON.stringify({ content: updated }),
        }).catch(() => {});
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
      id: "delete-current-note",
      name: "Delete current note",
      action: async () => {
        if (!activeTab) { showToast("No active note"); return; }
        if (!confirm(`Delete "${activeTab.path}"?`)) return;
        try {
          const res = await fetch(`/api/vault/file?path=${encodeURIComponent(activeTab.path)}`, { method: "DELETE", credentials: "include" });
          if (res.ok) {
            closeTab(activeTab.id, activePaneIdx);
            refreshTree();
            showToast(`Deleted ${activeTab.path}`);
          }
        } catch { showToast("Failed to delete"); }
      },
    },
    {
      id: "rename-current-note",
      name: "Rename current note",
      action: () => {
        if (!activeTab) { showToast("No active note"); return; }
        const oldName = activeTab.path.split("/").pop()?.replace(/\.md$/, "") ?? "";
        const newName = prompt("New name:", oldName);
        if (!newName || newName === oldName) return;
        const dir = activeTab.path.includes("/") ? activeTab.path.split("/").slice(0, -1).join("/") + "/" : "";
        const newPath = `${dir}${newName}.md`;
        fetch("/api/vault/rename", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ oldPath: activeTab.path, newPath }),
        }).then((r) => { if (r.ok) { refreshTree(); showToast(`Renamed to ${newName}`); openTab(newPath); } });
      },
    },
    {
      id: "duplicate-current-note",
      name: "Duplicate current note",
      action: async () => {
        if (!activeTab) { showToast("No active note"); return; }
        const baseName = activeTab.path.replace(/\.md$/, "");
        const newPath = `${baseName} (copy).md`;
        try {
          await fetch("/api/vault/file", {
            method: "PUT",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: newPath, content: activeTab.content }),
          });
          refreshTree();
          openTab(newPath);
          showToast(`Created ${newPath}`);
        } catch { showToast("Failed to duplicate"); }
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
        setAppSettings((s) => ({ ...s, editorFontSize: Math.min(24, s.editorFontSize + 1) }));
      },
    },
    {
      id: "decrease-font",
      name: "Decrease editor font size",
      action: () => {
        setAppSettings((s) => ({ ...s, editorFontSize: Math.max(10, s.editorFontSize - 1) }));
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
    ...["UPPERCASE", "lowercase", "Title Case"].map((label) => ({
      id: `transform-${label.toLowerCase().replace(/\s+/g, "-")}`,
      name: `Transform selection: ${label}`,
      shortcut: label === "UPPERCASE" ? "Ctrl+Shift+U" : undefined,
      action: () => {
        const editor = document.querySelector(".cm-editor") as HTMLElement | null;
        if (!editor) { showToast("Open a note in editor mode"); return; }
        const cmView = (editor as unknown as { cmView?: { view: { state: { selection: { main: { from: number; to: number } }; sliceDoc: (a: number, b: number) => string }; dispatch: (spec: Record<string, unknown>) => void } } }).cmView;
        if (!cmView) return;
        const view = cmView.view;
        const sel = view.state.selection.main;
        if (sel.from === sel.to) { showToast("Select text first"); return; }
        const text = view.state.sliceDoc(sel.from, sel.to);
        const transformed = label === "UPPERCASE" ? text.toUpperCase()
          : label === "lowercase" ? text.toLowerCase()
          : text.replace(/\b\w/g, (c: string) => c.toUpperCase());
        if (transformed !== text) {
          view.dispatch({ changes: { from: sel.from, to: sel.to, insert: transformed }, selection: { anchor: sel.from, head: sel.from + transformed.length } });
        }
      },
    })),
    {
      id: "toggle-readable-length",
      name: appSettings.readableLineLength ? "Disable readable line length" : "Enable readable line length",
      action: () => {
        const next = { ...appSettings, readableLineLength: !appSettings.readableLineLength };
        setAppSettings(next);
        import("../components/Settings.js").then(({ saveSettings }) => saveSettings(next));
      },
    },
    {
      id: "toggle-spellcheck",
      name: appSettings.spellCheck ? "Disable spell check" : "Enable spell check",
      action: () => {
        const next = { ...appSettings, spellCheck: !appSettings.spellCheck };
        setAppSettings(next);
        import("../components/Settings.js").then(({ saveSettings }) => saveSettings(next));
      },
    },
  ];

  // Demo mode commands
  if (isDemoMode()) {
    commands.push({
      id: "reset-demo-vault",
      name: "Reset demo vault to defaults",
      action: () => {
        resetDemoVault();
        refreshTree();
        showToast("Demo vault reset to defaults");
        if (activeTab) {
          fetch(`/api/vault/file?path=${encodeURIComponent(activeTab.path)}`, { credentials: "include" })
            .then((r) => r.json())
            .then((d) => { if (!d.error) updateTab(activeTab.id, { content: d.content }); });
        }
      },
    });
  }

  // Split/pane commands
  if (panes.length < 2) {
    commands.push({
      id: "split-right",
      name: "Split Right",
      action: splitRight,
    });
  } else {
    commands.push(
      {
        id: "close-split",
        name: "Close Split Pane",
        action: closeSplit,
      },
      {
        id: "sync-scroll",
        name: syncScroll ? "Disable Sync Scroll" : "Enable Sync Scroll",
        action: () => setSyncScroll((s) => !s),
      },
    );
  }

  return commands;
}
