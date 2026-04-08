import React from "react";
import type { Tab, Pane, ViewMode } from "../lib/appTypes.js";

const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
function kbd(shortcut: string): string {
  if (!isMac) return shortcut;
  return shortcut
    .replace(/Ctrl\+Shift\+/g, "⌃⇧")
    .replace(/Ctrl\+Alt\+/g, "⌃⌥")
    .replace(/Ctrl\+/g, "⌘")
    .replace(/Alt\+/g, "⌥")
    .replace(/Shift\+/g, "⇧");
}

interface TabBarProps {
  pane: Pane;
  paneIdx: number;
  paneTab: Tab | null;
  paneIsMarkdown: boolean;
  tabsMap: Record<string, Tab>;
  isMobile: boolean;
  // Refs
  navIdx: React.MutableRefObject<number>;
  navHistory: React.MutableRefObject<string[]>;
  navIgnore: React.MutableRefObject<boolean>;
  dragTabRef: React.MutableRefObject<{ tabId: string; paneIdx: number } | null>;
  closingTabs: React.MutableRefObject<Set<string>>;
  // State
  renamingTabId: string | null;
  justSavedTabId: string | null;
  // Callbacks
  setPanes: React.Dispatch<React.SetStateAction<Pane[]>>;
  setActivePaneIdx: (idx: number) => void;
  setTabsMap: React.Dispatch<React.SetStateAction<Record<string, Tab>>>;
  setLeftCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  setRenamingTabId: (id: string | null) => void;
  setTabCtxMenu: (menu: { x: number; y: number; tabId: string; paneIdx: number } | null) => void;
  openTab: (path: string) => void;
  closeTab: (tabId: string, paneIdx: number) => void;
  createNewNote: () => void;
  updateTab: (id: string, patch: Partial<Tab>) => void;
  refreshTree: () => void;
  showToast: (msg: string) => void;
}

export const TabBar = React.memo(function TabBar({
  pane, paneIdx, paneTab, paneIsMarkdown, tabsMap, isMobile,
  navIdx, navHistory, navIgnore, dragTabRef, closingTabs,
  renamingTabId, justSavedTabId,
  setPanes, setActivePaneIdx, setTabsMap, setLeftCollapsed,
  setRenamingTabId, setTabCtxMenu,
  openTab, closeTab, createNewNote, updateTab, refreshTree, showToast,
}: TabBarProps) {
  return (
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
      {/* Navigation back/forward buttons */}
      <NavButtons navIdx={navIdx} navHistory={navHistory} navIgnore={navIgnore} openTab={openTab} />

      <button className="tab-bar-scroll-btn left" onClick={(e) => {
        const bar = (e.currentTarget as HTMLElement).parentElement?.querySelector(".tab-bar");
        if (bar) bar.scrollBy({ left: -120, behavior: "smooth" });
      }}>‹</button>

      <div
        className="tab-bar"
        style={isMobile ? { paddingLeft: 0 } : undefined}
        onDoubleClick={(e) => { if (e.target === e.currentTarget) createNewNote(); }}
        onWheel={(e) => { e.currentTarget.scrollLeft += e.deltaY; }}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
        onDrop={(e) => {
          e.preventDefault();
          const src = dragTabRef.current;
          if (!src || src.paneIdx === paneIdx) return;
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
              background: "transparent", border: "none", color: "var(--text-muted)",
              fontSize: 16, cursor: "pointer", padding: "4px 8px", flexShrink: 0, lineHeight: 1,
            }}
            title="Toggle sidebar"
          >☰</button>
        )}

        {[...pane.tabIds].sort((a, b) => {
          const ap = tabsMap[a]?.pinned ? 0 : 1;
          const bp = tabsMap[b]?.pinned ? 0 : 1;
          return ap - bp;
        }).map((tid) => {
          const tab = tabsMap[tid];
          if (!tab) return null;
          return (
            <TabItem
              key={tab.id}
              tab={tab}
              pane={pane}
              paneIdx={paneIdx}
              isActive={tab.id === pane.activeTabId}
              isClosing={closingTabs.current.has(tab.id)}
              isRenaming={renamingTabId === tab.id}
              justSaved={justSavedTabId === tab.id}
              dragTabRef={dragTabRef}
              setPanes={setPanes}
              setActivePaneIdx={setActivePaneIdx}
              setRenamingTabId={setRenamingTabId}
              setTabCtxMenu={setTabCtxMenu}
              closeTab={closeTab}
              updateTab={updateTab}
              refreshTree={refreshTree}
              showToast={showToast}
            />
          );
        })}

        <button
          className="tab-bar-new"
          title={`New note (${kbd("Ctrl+N")})`}
          onClick={createNewNote}
          style={{
            background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer",
            padding: "2px 6px", fontSize: 18, lineHeight: 1, flexShrink: 0, borderRadius: 4,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
        >+</button>

        <div className="tab-indicator" ref={(el) => {
          if (!el) return;
          const bar = el.parentElement;
          if (!bar) return;
          const activeEl = bar.querySelector<HTMLElement>(".tab.active");
          if (activeEl) {
            el.style.left = activeEl.offsetLeft + "px";
            el.style.width = activeEl.offsetWidth + "px";
          } else {
            el.style.width = "0px";
          }
        }} />

        {paneTab && paneIsMarkdown && (
          <ModeToggle paneTab={paneTab} updateTab={updateTab} />
        )}
      </div>

      <button className="tab-bar-scroll-btn right" onClick={(e) => {
        const bar = (e.currentTarget as HTMLElement).parentElement?.querySelector(".tab-bar");
        if (bar) bar.scrollBy({ left: 120, behavior: "smooth" });
      }} title={`${pane.tabIds.length} tabs`}>
        ›
        <span className="tab-count-badge">{pane.tabIds.length}</span>
      </button>

      {/* Tab overflow dropdown */}
      {pane.tabIds.length > 3 && (
        <TabOverflowMenu
          pane={pane}
          paneIdx={paneIdx}
          tabsMap={tabsMap}
          setPanes={setPanes}
          setActivePaneIdx={setActivePaneIdx}
        />
      )}
    </div>
  );
});

/* ---------- Sub-components ---------- */

function NavButtons({ navIdx, navHistory, navIgnore, openTab }: {
  navIdx: React.MutableRefObject<number>;
  navHistory: React.MutableRefObject<string[]>;
  navIgnore: React.MutableRefObject<boolean>;
  openTab: (path: string) => void;
}) {
  const canBack = navIdx.current > 0;
  const canFwd = navIdx.current < navHistory.current.length - 1;
  return (
    <div style={{ display: "flex", gap: 1, alignItems: "center", paddingLeft: 4, flexShrink: 0 }}>
      <button
        onClick={() => {
          if (navIdx.current > 0) {
            navIdx.current--;
            navIgnore.current = true;
            openTab(navHistory.current[navIdx.current]);
          }
        }}
        disabled={!canBack}
        title="Navigate back (Alt+←)"
        style={{
          background: "none", border: "none",
          color: canBack ? "var(--text-secondary)" : "var(--text-faint)",
          cursor: canBack ? "pointer" : "default",
          fontSize: 14, padding: "2px 4px", lineHeight: 1,
          opacity: canBack ? 0.8 : 0.3,
        }}
      >←</button>
      <button
        onClick={() => {
          if (navIdx.current < navHistory.current.length - 1) {
            navIdx.current++;
            navIgnore.current = true;
            openTab(navHistory.current[navIdx.current]);
          }
        }}
        disabled={!canFwd}
        title="Navigate forward (Alt+→)"
        style={{
          background: "none", border: "none",
          color: canFwd ? "var(--text-secondary)" : "var(--text-faint)",
          cursor: canFwd ? "pointer" : "default",
          fontSize: 14, padding: "2px 4px", lineHeight: 1,
          opacity: canFwd ? 0.8 : 0.3,
        }}
      >→</button>
    </div>
  );
}

function TabItem({ tab, pane, paneIdx, isActive, isClosing, isRenaming, justSaved,
  dragTabRef, setPanes, setActivePaneIdx, setRenamingTabId, setTabCtxMenu,
  closeTab, updateTab, refreshTree, showToast,
}: {
  tab: Tab;
  pane: Pane;
  paneIdx: number;
  isActive: boolean;
  isClosing: boolean;
  isRenaming: boolean;
  justSaved: boolean;
  dragTabRef: React.MutableRefObject<{ tabId: string; paneIdx: number } | null>;
  setPanes: React.Dispatch<React.SetStateAction<Pane[]>>;
  setActivePaneIdx: (idx: number) => void;
  setRenamingTabId: (id: string | null) => void;
  setTabCtxMenu: (menu: { x: number; y: number; tabId: string; paneIdx: number } | null) => void;
  closeTab: (tabId: string, paneIdx: number) => void;
  updateTab: (id: string, patch: Partial<Tab>) => void;
  refreshTree: () => void;
  showToast: (msg: string) => void;
}) {
  const tabTitle = buildTabTooltip(tab);
  const name = tab.path.split("/").pop()?.replace(/\.md$/, "") ?? tab.path;

  return (
    <div
      data-tab-id={tab.id}
      ref={(el) => {
        if (el && isActive) el.scrollIntoView({ block: "nearest", inline: "nearest" });
      }}
      className={`tab ${isActive ? "active" : ""}${tab.pinned ? " pinned" : ""}${isClosing ? " tab-closing" : ""}`}
      title={tabTitle}
      style={tab.color ? { borderTop: `2px solid ${tab.color}`, paddingTop: 4 } : undefined}
      draggable
      onDragStart={(e) => { dragTabRef.current = { tabId: tab.id, paneIdx }; e.dataTransfer.effectAllowed = "move"; }}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
      onDrop={(e) => {
        e.preventDefault();
        const src = dragTabRef.current;
        if (!src || src.tabId === tab.id) return;
        if (src.paneIdx === paneIdx) {
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
          setPanes((prev) => {
            const next = prev.map((p) => ({ ...p, tabIds: [...p.tabIds] }));
            const srcPane = next[src.paneIdx];
            const dstPane = next[paneIdx];
            const srcIdx = srcPane.tabIds.indexOf(src.tabId);
            if (srcIdx === -1) return prev;
            srcPane.tabIds.splice(srcIdx, 1);
            if (srcPane.activeTabId === src.tabId) {
              srcPane.activeTabId = srcPane.tabIds[Math.min(srcIdx, srcPane.tabIds.length - 1)] ?? null;
            }
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
        if (e.button === 1 && !tab.pinned) { e.preventDefault(); closeTab(tab.id, paneIdx); }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setTabCtxMenu({ x: e.clientX, y: e.clientY, tabId: tab.id, paneIdx });
      }}
    >
      {tab.pinned ? (
        <PinnedTabContent name={name} />
      ) : isRenaming ? (
        <RenameInput
          tab={tab}
          setRenamingTabId={setRenamingTabId}
          updateTab={updateTab}
          refreshTree={refreshTree}
          showToast={showToast}
        />
      ) : (
        <TabContent
          tab={tab}
          name={name}
          justSaved={justSaved}
          paneIdx={paneIdx}
          setRenamingTabId={setRenamingTabId}
          closeTab={closeTab}
        />
      )}
    </div>
  );
}

function PinnedTabContent({ name }: { name: string }) {
  return (
    <span className="tab-name" title={name} style={{ maxWidth: 40, overflow: "hidden", textOverflow: "clip", display: "flex", alignItems: "center", gap: 2 }}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none" style={{ flexShrink: 0, opacity: 0.6 }}>
        <path d="M16 3l-4 4-4-4-2 2 4 4-5 5v2h2l5-5 4 4 2-2-4-4 4-4z" />
      </svg>
      {name.slice(0, 2)}
    </span>
  );
}

function RenameInput({ tab, setRenamingTabId, updateTab, refreshTree, showToast }: {
  tab: Tab;
  setRenamingTabId: (id: string | null) => void;
  updateTab: (id: string, patch: Partial<Tab>) => void;
  refreshTree: () => void;
  showToast: (msg: string) => void;
}) {
  return (
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
  );
}

function TabContent({ tab, name, justSaved, paneIdx, setRenamingTabId, closeTab }: {
  tab: Tab;
  name: string;
  justSaved: boolean;
  paneIdx: number;
  setRenamingTabId: (id: string | null) => void;
  closeTab: (tabId: string, paneIdx: number) => void;
}) {
  return (
    <>
      <span
        className="tab-name"
        onDoubleClick={(e) => { e.stopPropagation(); setRenamingTabId(tab.id); }}
      >
        {tab.dirty ? <span style={{ color: "var(--accent-color)", marginRight: 2 }}>●</span> : justSaved ? <span style={{ color: "var(--color-green)", marginRight: 2, fontSize: 10 }}>✓</span> : null}
        {name}
        <WordGoalRing tab={tab} />
        {tab.backlinks.length > 0 && (
          <span title={`${tab.backlinks.length} backlink${tab.backlinks.length !== 1 ? "s" : ""}`} style={{
            display: "inline-flex", alignItems: "center", marginLeft: 3, fontSize: 9,
            color: "var(--text-faint)", background: "rgba(255,255,255,0.06)",
            borderRadius: 6, padding: "0 4px", lineHeight: "14px", flexShrink: 0,
          }}>
            {tab.backlinks.length}
          </span>
        )}
      </span>
      <button className="tab-close" onClick={(e) => { e.stopPropagation(); closeTab(tab.id, paneIdx); }}>×</button>
    </>
  );
}

function WordGoalRing({ tab }: { tab: Tab }) {
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
  const r = 5;
  const circ = 2 * Math.PI * r;
  const color = pct >= 1 ? "var(--color-green)" : "var(--accent-color)";
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
}

function ModeToggle({ paneTab, updateTab }: { paneTab: Tab; updateTab: (id: string, patch: Partial<Tab>) => void }) {
  return (
    <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", paddingRight: 8 }}>
      <button
        className="mode-toggle-btn"
        title={paneTab.mode === "read" ? `Switch to Live Preview (${kbd("Ctrl+E")})` : paneTab.mode === "edit" ? `Switch to Source mode (${kbd("Ctrl+E")})` : paneTab.mode === "kanban" ? `Switch to Reading view (${kbd("Ctrl+E")})` : `Switch to Reading view (${kbd("Ctrl+E")})`}
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
  );
}

function TabOverflowMenu({ pane, paneIdx, tabsMap, setPanes, setActivePaneIdx }: {
  pane: Pane;
  paneIdx: number;
  tabsMap: Record<string, Tab>;
  setPanes: React.Dispatch<React.SetStateAction<Pane[]>>;
  setActivePaneIdx: (idx: number) => void;
}) {
  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <button
        className="tab-overflow-btn"
        onClick={(e) => {
          const menu = (e.currentTarget as HTMLElement).nextElementSibling as HTMLElement;
          if (menu) menu.style.display = menu.style.display === "block" ? "none" : "block";
        }}
        title="All tabs"
        style={{
          background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer",
          fontSize: 11, padding: "4px 6px", lineHeight: 1, display: "flex", alignItems: "center", gap: 2,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="1" y="2" width="5" height="4" rx="0.5" stroke="currentColor" strokeWidth="1" />
          <rect x="8" y="2" width="5" height="4" rx="0.5" stroke="currentColor" strokeWidth="1" />
          <rect x="1" y="8" width="5" height="4" rx="0.5" stroke="currentColor" strokeWidth="1" />
          <rect x="8" y="8" width="5" height="4" rx="0.5" stroke="currentColor" strokeWidth="1" />
        </svg>
      </button>
      <div
        className="tab-overflow-menu"
        style={{ display: "none", position: "absolute", top: "100%", right: 0, background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: 6, padding: "4px 0", zIndex: 9999, minWidth: 200, maxHeight: 300, overflowY: "auto", boxShadow: "0 4px 16px rgba(0,0,0,0.3)" }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.display = "none"; }}
      >
        {pane.tabIds.map((tid) => {
          const t = tabsMap[tid];
          if (!t) return null;
          const tName = t.path.split("/").pop()?.replace(/\.md$/, "") ?? t.path;
          const isActive = tid === pane.activeTabId;
          return (
            <div
              key={tid}
              onClick={() => {
                setPanes((prev) => prev.map((p, i) => i === paneIdx ? { ...p, activeTabId: tid } : p));
                setActivePaneIdx(paneIdx);
                const menu = document.querySelector(".tab-overflow-menu") as HTMLElement;
                if (menu) menu.style.display = "none";
              }}
              style={{
                padding: "5px 12px", cursor: "pointer", fontSize: 12,
                color: isActive ? "var(--accent-color)" : "var(--text-normal)",
                fontWeight: isActive ? 600 : 400,
                display: "flex", alignItems: "center", gap: 6,
                background: isActive ? "var(--bg-tertiary)" : "transparent",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--bg-tertiary)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = isActive ? "var(--bg-tertiary)" : ""; }}
            >
              {t.dirty && <span style={{ color: "var(--accent-color)", fontSize: 8 }}>●</span>}
              {t.pinned && <span style={{ fontSize: 10, color: "var(--text-faint)" }}>📌</span>}
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tName}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Helpers ---------- */

function buildTabTooltip(tab: Tab): string {
  const words = tab.content ? tab.content.replace(/^---[\t ]*\r?\n[\s\S]*?\n---[\t ]*(?:\r?\n|$)/, "").trim().split(/\s+/).filter(Boolean).length : 0;
  const bl = tab.backlinks.length;
  const lines = [tab.path];
  if (words > 0) lines.push(`${words.toLocaleString()} words · ~${Math.max(1, Math.ceil(words / 200))} min read`);
  if (bl > 0) lines.push(`${bl} backlink${bl !== 1 ? "s" : ""}`);
  if (tab.fileModified) lines.push(`Modified: ${new Date(tab.fileModified).toLocaleString()}`);
  const tagMatches = tab.content?.match(/(?:^|\s)#([A-Za-z][\w/-]*)/g);
  if (tagMatches && tagMatches.length > 0) {
    const tags = [...new Set(tagMatches.map((t) => t.trim()))].slice(0, 5);
    lines.push(`Tags: ${tags.join(", ")}`);
  }
  if (tab.content) {
    const bodyText = tab.content.replace(/^---[\t ]*\r?\n[\s\S]*?\n---[\t ]*(?:\r?\n|$)/, "").trim();
    const firstLine = bodyText.split("\n").find((l) => l.trim() && !l.startsWith("#"))?.trim();
    if (firstLine) lines.push(`"${firstLine.slice(0, 80)}${firstLine.length > 80 ? "…" : ""}"`);
  }
  return lines.join("\n");
}
