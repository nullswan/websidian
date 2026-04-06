import React from "react";
import type { Tab, Pane } from "../lib/appTypes.js";

interface TabContextMenuProps {
  x: number;
  y: number;
  tabId: string;
  paneIdx: number;
  tabsMap: Record<string, Tab>;
  panes: Pane[];
  starredNotes: string[];
  onClose: () => void;
  onUpdateTab: (id: string, patch: Partial<Tab>) => void;
  onCloseTab: (tabId: string, paneIdx: number) => void;
  onOpenTab: (path: string, paneIdx?: number) => void;
  onSetPanes: React.Dispatch<React.SetStateAction<Pane[]>>;
  onSetTabsMap: React.Dispatch<React.SetStateAction<Record<string, Tab>>>;
  onSetLeftPanel: (panel: "files" | "search" | "plugins" | "starred" | "recent" | "trash") => void;
  onToggleStar: (path: string) => void;
  onDuplicateNote: (path: string) => void;
  onSetDiffSource: (path: string) => void;
  onShowToast: (msg: string) => void;
  nextTabId: () => string;
}

const TAB_COLORS = ["", "#e06c75", "#e5c07b", "#98c379", "#61afef", "#c678dd", "#56b6c2"];

export const TabContextMenu = React.memo(function TabContextMenu({
  x, y, tabId, paneIdx, tabsMap, panes, starredNotes,
  onClose, onUpdateTab, onCloseTab, onOpenTab,
  onSetPanes, onSetTabsMap, onSetLeftPanel,
  onToggleStar, onDuplicateNote, onSetDiffSource,
  onShowToast, nextTabId,
}: TabContextMenuProps) {
  const tab = tabsMap[tabId];

  const items: Array<
    | { type: "separator" }
    | { type: "color-picker" }
    | { label: string; action: () => void }
  > = [
    {
      label: tab?.pinned ? "Unpin Tab" : "Pin Tab",
      action: () => { if (tab) onUpdateTab(tabId, { pinned: !tab.pinned }); },
    },
    {
      label: "Open in New Pane",
      action: () => {
        if (panes.length >= 2 || !tab) return;
        onSetPanes((prev) => [...prev, { tabIds: [], activeTabId: null }]);
        setTimeout(() => onOpenTab(tab.path, panes.length), 0);
      },
    },
    { type: "separator" },
    { label: "Close", action: () => onCloseTab(tabId, paneIdx) },
    {
      label: "Close Others",
      action: () => {
        const pane = panes[paneIdx];
        const others = pane.tabIds.filter((t) => t !== tabId && !tabsMap[t]?.pinned);
        for (const tid of others) onCloseTab(tid, paneIdx);
      },
    },
    {
      label: "Close All",
      action: () => {
        const pane = panes[paneIdx];
        for (const tid of [...pane.tabIds]) {
          if (!tabsMap[tid]?.pinned) onCloseTab(tid, paneIdx);
        }
      },
    },
    {
      label: "Close Tabs to the Right",
      action: () => {
        const pane = panes[paneIdx];
        const idx = pane.tabIds.indexOf(tabId);
        const right = pane.tabIds.slice(idx + 1).filter((t) => !tabsMap[t]?.pinned);
        for (const tid of right) onCloseTab(tid, paneIdx);
      },
    },
    {
      label: "Close Tabs to the Left",
      action: () => {
        const pane = panes[paneIdx];
        const idx = pane.tabIds.indexOf(tabId);
        const left = pane.tabIds.slice(0, idx).filter((t) => !tabsMap[t]?.pinned);
        for (const tid of left) onCloseTab(tid, paneIdx);
      },
    },
    { type: "separator" },
    {
      label: "Copy Path",
      action: () => {
        if (tab) {
          navigator.clipboard.writeText(tab.path).catch(() => {});
          onShowToast("Path copied to clipboard");
        }
      },
    },
    {
      label: "Copy Note Link",
      action: () => {
        if (tab) {
          const name = tab.path.replace(/\.md$/, "").split("/").pop() || tab.path;
          navigator.clipboard.writeText(`[[${name}]]`).catch(() => {});
          onShowToast(`Copied [[${name}]]`);
        }
      },
    },
    {
      label: "Share Note",
      action: () => {
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
              onShowToast("Share link copied!");
            }
          });
      },
    },
    {
      label: "Reveal in File Tree",
      action: () => onSetLeftPanel("files"),
    },
    {
      label: "Duplicate",
      action: () => { if (tab) onDuplicateNote(tab.path); },
    },
    {
      label: starredNotes.includes(tab?.path ?? "") ? "Unstar" : "Star",
      action: () => { if (tab) onToggleStar(tab.path); },
    },
    { type: "color-picker" },
    {
      label: "Compare with...",
      action: () => { if (tab) onSetDiffSource(tab.path); },
    },
    { type: "separator" },
    {
      label: "Split Right",
      action: () => {
        if (!tab || panes.length >= 2) return;
        const newId = nextTabId();
        const newTab: Tab = { ...tab, id: newId };
        onSetTabsMap((prev) => ({ ...prev, [newId]: newTab }));
        onSetPanes((prev) => [...prev, { tabIds: [newId], activeTabId: newId }]);
        fetch(`/api/vault/file?path=${encodeURIComponent(tab.path)}`, { credentials: "include" })
          .then((r) => r.json())
          .then((d) => { if (!d.error) onUpdateTab(newId, { content: d.content, fileCreated: d.created, fileModified: d.modified, fileSize: d.size }); });
      },
    },
  ];

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 900 }}
      onClick={onClose}
      onContextMenu={(e) => { e.preventDefault(); onClose(); }}
    >
      <div
        style={{
          position: "absolute",
          left: x,
          top: y,
          background: "var(--bg-tertiary)",
          border: "1px solid var(--border-color)",
          borderRadius: 6,
          padding: "4px 0",
          minWidth: 160,
          boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
          fontSize: 13,
          animation: "ctx-menu-in 0.12s ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {items.map((item, i) =>
          "type" in item && item.type === "separator" ? (
            <div key={i} style={{ borderTop: "1px solid var(--border-color)", margin: "4px 0" }} />
          ) : "type" in item && item.type === "color-picker" ? (
            <div key={i} style={{ padding: "4px 12px", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)", marginRight: 4 }}>Color</span>
              {TAB_COLORS.map((c) => (
                <span
                  key={c || "none"}
                  onClick={() => {
                    onUpdateTab(tabId, { color: c || undefined });
                    onClose();
                  }}
                  style={{
                    width: 14, height: 14, borderRadius: "50%", cursor: "pointer",
                    background: c || "var(--bg-tertiary)",
                    border: (tab?.color ?? "") === c ? "2px solid var(--text-primary)" : "1px solid var(--border-color)",
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
                onClose();
              }}
            >
              {(item as { label: string }).label}
            </div>
          ),
        )}
      </div>
    </div>
  );
});
