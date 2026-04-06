import React, { useState } from "react";

interface SidebarSectionProps {
  title: string;
  defaultOpen?: boolean;
  badge?: number;
  children: React.ReactNode;
}

export const SidebarSection = React.memo(function SidebarSection({ title, defaultOpen = true, badge, children }: SidebarSectionProps) {
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
          letterSpacing: "0.08em",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 6,
          userSelect: "none",
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLElement;
          el.style.color = "var(--text-secondary)";
          const span = el.querySelector<HTMLElement>(".sidebar-section-title");
          if (span) { span.style.backgroundImage = "linear-gradient(90deg, var(--text-secondary), var(--accent-color))"; }
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLElement;
          el.style.color = "var(--text-muted)";
          const span = el.querySelector<HTMLElement>(".sidebar-section-title");
          if (span) { span.style.backgroundImage = "linear-gradient(90deg, var(--text-muted), var(--text-muted))"; }
        }}
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
        <span
          className="sidebar-section-title"
          style={{
            background: "linear-gradient(90deg, var(--text-muted), var(--text-muted))",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            transition: "background-image 0.3s ease",
          }}
        >
          {title}
        </span>
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
});
