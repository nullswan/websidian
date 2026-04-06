import React from "react";

type LeftPanel = "files" | "search" | "plugins" | "starred" | "recent" | "trash";

interface RibbonProps {
  leftPanel: LeftPanel;
  leftCollapsed: boolean;
  showGraph: boolean;
  onPanelChange: (panel: LeftPanel) => void;
  onToggleCollapse: (collapsed: boolean) => void;
  onToggleGraph: () => void;
  onToggleCalendar: () => void;
  onToggleSettings: () => void;
  onRandomNote: () => void;
  onRefreshTrash: () => void;
  calendarAnchorRef: React.RefObject<HTMLButtonElement | null>;
}

const PANEL_ITEMS: { id: LeftPanel | "graph"; title: string; icon: React.ReactNode }[] = [
  {
    id: "files",
    title: "File explorer",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3h7l2 2h9v15H3z" />
        <path d="M3 10h18" />
      </svg>
    ),
  },
  {
    id: "search",
    title: "Search",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
      </svg>
    ),
  },
  {
    id: "graph",
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
    id: "starred",
    title: "Starred notes",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  },
  {
    id: "recent",
    title: "Recent files",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
  },
  {
    id: "plugins",
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
    id: "trash",
    title: "Trash",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </svg>
    ),
  },
];

const ribbonBtnStyle: React.CSSProperties = {
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
};

export const Ribbon = React.memo(function Ribbon({
  leftPanel,
  leftCollapsed,
  showGraph,
  onPanelChange,
  onToggleCollapse,
  onToggleGraph,
  onToggleCalendar,
  onToggleSettings,
  onRandomNote,
  onRefreshTrash,
  calendarAnchorRef,
}: RibbonProps) {
  return (
    <div
      style={{
        width: 44,
        background: "var(--bg-primary)",
        borderRight: "1px solid var(--bg-tertiary)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: 8,
        gap: 2,
        flexShrink: 0,
      }}
    >
      {PANEL_ITEMS.map((item) => {
        const isGraph = item.id === "graph";
        const isActive = isGraph ? showGraph : leftPanel === item.id;
        const isActiveVisible = isGraph ? showGraph : leftPanel === item.id && !leftCollapsed;
        return (
          <button
            key={item.id}
            title={item.title}
            onClick={() => {
              if (isGraph) {
                onToggleGraph();
              } else if (leftPanel === item.id && !leftCollapsed) {
                onToggleCollapse(true);
              } else {
                onPanelChange(item.id as LeftPanel);
                onToggleCollapse(false);
                if (item.id === "trash") onRefreshTrash();
              }
            }}
            style={{
              ...ribbonBtnStyle,
              background: isActive ? "var(--bg-tertiary)" : "transparent",
              color: isActive ? "var(--text-primary)" : "var(--text-faint)",
              borderLeft: isActiveVisible ? "2px solid var(--accent-color)" : "2px solid transparent",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"; }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = isActive ? "var(--text-primary)" : "var(--text-faint)";
            }}
          >
            {item.icon}
          </button>
        );
      })}

      {/* Daily note / Calendar */}
      <button
        ref={calendarAnchorRef}
        title="Daily notes calendar (click) / Open today (Ctrl+D)"
        onClick={onToggleCalendar}
        style={ribbonBtnStyle}
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
        onClick={onRandomNote}
        style={{ ...ribbonBtnStyle, marginBottom: 4 }}
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
        onClick={onToggleSettings}
        style={{ ...ribbonBtnStyle, marginBottom: 8 }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-faint)"; }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" />
        </svg>
      </button>
    </div>
  );
});
