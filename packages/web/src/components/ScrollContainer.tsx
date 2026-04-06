import { useState, useEffect, useRef } from "react";
import { Minimap } from "./Minimap.js";
import type { Tab } from "../lib/appTypes.js";

interface ScrollContainerProps {
  tabId: string | null;
  scrollTop: number;
  updateTab: (id: string, patch: Partial<Tab>) => void;
  children: React.ReactNode;
  className?: string;
  mode?: string;
  noteContent?: string;
  showMinimap?: boolean;
  onProgressChange?: (progress: number) => void;
  searchQuery?: string;
  notePath?: string;
  syncScrollRef?: (el: HTMLDivElement | null) => void;
  onSyncScroll?: (fraction: number) => void;
  headings?: Array<{ text: string; level: number; line: number }>;
}

export function ScrollContainer({ tabId, scrollTop, updateTab, children, className, noteContent, showMinimap, onProgressChange, searchQuery, notePath, syncScrollRef, onSyncScroll, headings, mode }: ScrollContainerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const lastTabId = useRef<string | null>(null);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [progress, setProgress] = useState(0);
  const [scrollMetrics, setScrollMetrics] = useState({ scrollTop: 0, scrollHeight: 1, clientHeight: 1 });

  useEffect(() => {
    syncScrollRef?.(ref.current);
    return () => syncScrollRef?.(null);
  }, [syncScrollRef]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !tabId) return;

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
      onSyncScroll?.(p);
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
          <div key={`${tabId}-${mode ?? ""}`} className="note-content-fade">{children}</div>
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
        {headings && headings.length > 1 && noteContent && (() => {
          const totalLines = noteContent.split("\n").length;
          const scrollFrac = scrollMetrics.scrollHeight > scrollMetrics.clientHeight
            ? scrollMetrics.scrollTop / (scrollMetrics.scrollHeight - scrollMetrics.clientHeight) : 0;
          const minLevel = Math.min(...headings.map((h) => h.level));
          return (
            <div className="floating-toc" style={{
              position: "absolute", right: showMinimap ? 50 : 8, top: 8, bottom: 8,
              maxWidth: 180, display: "flex", flexDirection: "column", gap: 1,
              zIndex: 5, pointerEvents: "auto", overflowY: "auto", overflowX: "hidden",
              padding: "4px 0",
            }}>
              {headings.map((h, i) => {
                const frac = h.line / totalLines;
                const isActive = i === headings.length - 1
                  ? scrollFrac >= frac - 0.02
                  : scrollFrac >= frac - 0.02 && scrollFrac < (headings[i + 1].line / totalLines) - 0.02;
                const indent = (h.level - minLevel) * 10;
                return (
                  <div
                    key={i}
                    onClick={() => {
                      if (!ref.current) return;
                      const max = ref.current.scrollHeight - ref.current.clientHeight;
                      ref.current.scrollTo({ top: frac * max, behavior: "smooth" });
                    }}
                    style={{
                      paddingLeft: indent + 6,
                      paddingRight: 6,
                      paddingTop: 2,
                      paddingBottom: 2,
                      fontSize: 10,
                      lineHeight: 1.3,
                      color: isActive ? "var(--accent-color)" : "var(--text-faint)",
                      fontWeight: isActive ? 600 : 400,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      borderLeft: isActive ? "2px solid var(--accent-color)" : "2px solid transparent",
                      transition: "all 0.15s",
                      opacity: isActive ? 1 : 0.6,
                      borderRadius: 2,
                    }}
                    title={h.text}
                  >
                    {h.text}
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
