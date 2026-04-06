import { useMemo, useState, useEffect, useRef } from "react";

interface Heading {
  level: number;
  text: string;
  id: string;
  lineNumber: number;
  wordCount: number;
}

interface OutlineProps {
  content: string;
  onScrollToHeading?: (heading: string, level: number) => void;
  onReorderSection?: (fromHeadingLine: number, fromHeadingLevel: number, toHeadingLine: number) => void;
}

export function Outline({ content, onScrollToHeading, onReorderSection }: OutlineProps) {
  const headings = useMemo(() => extractHeadings(content), [content]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [dragIdx, setDragIdx] = useState(-1);
  const [dropIdx, setDropIdx] = useState(-1);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Track which heading is currently visible in the reader
  useEffect(() => {
    if (headings.length === 0) return;

    // Small delay to let the reader render
    const timer = setTimeout(() => {
      const readerHeadings = document.querySelectorAll(
        ".reader-view h1, .reader-view h2, .reader-view h3, .reader-view h4, .reader-view h5, .reader-view h6",
      );
      if (readerHeadings.length === 0) return;

      // Build a map from DOM heading to outline index
      const headingToIdx = new Map<Element, number>();
      let outlineIdx = 0;
      for (const el of readerHeadings) {
        const text = el.textContent?.replace(/^▶/, "").trim();
        if (outlineIdx < headings.length && text === headings[outlineIdx].text) {
          headingToIdx.set(el, outlineIdx);
          outlineIdx++;
        }
      }

      observerRef.current = new IntersectionObserver(
        (entries) => {
          // Find the topmost visible heading
          for (const entry of entries) {
            if (entry.isIntersecting) {
              const idx = headingToIdx.get(entry.target);
              if (idx !== undefined) setActiveIdx(idx);
            }
          }
        },
        { rootMargin: "-10% 0px -80% 0px" },
      );

      for (const el of headingToIdx.keys()) {
        observerRef.current.observe(el);
      }
    }, 200);

    return () => {
      clearTimeout(timer);
      observerRef.current?.disconnect();
    };
  }, [headings, content]);

  if (headings.length === 0) return null;

  const minLevel = headings.reduce((min, h) => Math.min(min, h.level), 6);

  // Determine which headings have children (next heading has higher level)
  const hasChildren = headings.map((h, i) => {
    for (let j = i + 1; j < headings.length; j++) {
      if (headings[j].level <= h.level) break;
      if (headings[j].level > h.level) return true;
    }
    return false;
  });

  // Determine visibility: a heading is hidden if any ancestor is collapsed
  const isVisible = (idx: number): boolean => {
    const h = headings[idx];
    // Walk backwards to find parent headings at lower levels
    for (let j = idx - 1; j >= 0; j--) {
      if (headings[j].level < h.level) {
        // This is a potential parent
        if (collapsed.has(j)) return false;
        // Check if this parent itself is hidden
        return isVisible(j);
      }
    }
    return true;
  };

  const toggleCollapse = (idx: number) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  // Compute visible item indices for position indicator
  const visibleIndices = headings.map((_, i) => i).filter(i => isVisible(i));
  const activeVisiblePos = visibleIndices.indexOf(activeIdx);

  return (
    <div style={{ padding: "4px 12px 8px" }}>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, position: "relative" }}>
        {/* Position indicator track */}
        {visibleIndices.length > 1 && activeVisiblePos >= 0 && (
          <div style={{
            position: "absolute",
            left: -8,
            top: 0,
            bottom: 0,
            width: 3,
            background: "var(--border-color)",
            borderRadius: 2,
            opacity: 0.3,
            pointerEvents: "none",
          }}>
            <div style={{
              position: "absolute",
              top: `${(activeVisiblePos / (visibleIndices.length - 1)) * 100}%`,
              left: 0,
              width: 3,
              height: Math.max(12, 100 / visibleIndices.length) + "%",
              maxHeight: 24,
              background: "var(--accent-color)",
              borderRadius: 2,
              transition: "top 0.2s ease",
            }} />
          </div>
        )}
        {/* Indent guide lines */}
        {Array.from(new Set(headings.map((h) => h.level - minLevel))).filter((d) => d > 0).map((depth) => (
          <div key={`guide-${depth}`} style={{
            position: "absolute",
            left: depth * 12 - 7,
            top: 0,
            bottom: 0,
            width: 1,
            background: "var(--border-color)",
            opacity: 0.4,
            pointerEvents: "none",
          }} />
        ))}
        {headings.map((h, i) => {
          if (!isVisible(i)) return null;
          return (
          <li key={i}>
            <div
              draggable={!!onReorderSection}
              onDragStart={(e) => {
                setDragIdx(i);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", String(i));
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setDropIdx(i);
              }}
              onDragLeave={() => { if (dropIdx === i) setDropIdx(-1); }}
              onDrop={(e) => {
                e.preventDefault();
                const fromIdx = dragIdx;
                setDragIdx(-1);
                setDropIdx(-1);
                if (fromIdx !== -1 && fromIdx !== i && onReorderSection) {
                  onReorderSection(headings[fromIdx].lineNumber, headings[fromIdx].level, headings[i].lineNumber);
                }
              }}
              onDragEnd={() => { setDragIdx(-1); setDropIdx(-1); }}
              style={{
                paddingLeft: (h.level - minLevel) * 12,
                padding: `2px 0 2px ${(h.level - minLevel) * 12}px`,
                fontSize: 12,
                display: "flex",
                alignItems: "center",
                color: i === activeIdx
                  ? "var(--accent-color)"
                  : h.level === 1 ? "var(--text-primary)" : h.level === 2 ? "var(--text-secondary)" : "var(--text-muted)",
                cursor: onReorderSection ? "grab" : "pointer",
                borderRadius: 3,
                fontWeight: i === activeIdx ? 600 : "normal",
                borderLeft: i === activeIdx ? "2px solid var(--accent-color)" : "2px solid transparent",
                marginLeft: -2,
                opacity: dragIdx === i ? 0.4 : 1,
                borderTop: dropIdx === i && dragIdx !== i ? "2px solid var(--accent-color)" : "2px solid transparent",
                transition: "opacity 0.15s",
              }}
              onClick={() => {
                const flashEl = (el: Element) => {
                  el.classList.remove("heading-flash");
                  void (el as HTMLElement).offsetWidth; // reflow
                  el.classList.add("heading-flash");
                };
                // Try heading ID first (most reliable)
                const byId = document.getElementById(h.id);
                if (byId) {
                  byId.scrollIntoView({ behavior: "smooth", block: "start" });
                  flashEl(byId);
                  setActiveIdx(i);
                  return;
                }
                // Fallback: text-match in reader view
                const allHeadings = document.querySelectorAll(
                  ".reader-view h1, .reader-view h2, .reader-view h3, .reader-view h4, .reader-view h5, .reader-view h6",
                );
                for (const heading of allHeadings) {
                  const text = heading.textContent?.replace(/^▶/, "").trim();
                  if (text === h.text) {
                    heading.scrollIntoView({ behavior: "smooth", block: "start" });
                    flashEl(heading);
                    setActiveIdx(i);
                    return;
                  }
                }
                // Fallback: editor mode — use callback to scroll CM6 view
                if (onScrollToHeading) {
                  onScrollToHeading(h.text, h.level);
                  setActiveIdx(i);
                }
              }}
            >
              {hasChildren[i] && (
                <span
                  onClick={(e) => { e.stopPropagation(); toggleCollapse(i); }}
                  style={{ width: 12, fontSize: 9, color: "var(--text-faint)", cursor: "pointer", flexShrink: 0, textAlign: "center", marginRight: 2 }}
                >{collapsed.has(i) ? "▸" : "▾"}</span>
              )}
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.text}</span>
              {h.wordCount > 0 && (
                <span style={{ fontSize: 9, color: "var(--text-faint)", marginLeft: 4, flexShrink: 0 }}>{h.wordCount}w</span>
              )}
            </div>
          </li>
        );
        })}
      </ul>
    </div>
  );
}

function extractHeadings(content: string): Heading[] {
  // Strip frontmatter
  const fmMatch = /^---[\t ]*\r?\n[\s\S]*?\n---[\t ]*(?:\r?\n|$)/.exec(content);
  const body = fmMatch ? content.slice(fmMatch[0].length) : content;
  const fmLineCount = fmMatch ? fmMatch[0].split("\n").length - 1 : 0;

  const headings: Heading[] = [];
  const slugCounts: Record<string, number> = {};
  const lines = body.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = /^(#{1,6})\s+(.+)$/.exec(line);
    if (match) {
      const text = match[2].trim().replace(/\s*\^[\w-]+$/, "");
      let slug = text.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/^-+|-+$/g, "");
      if (!slug) slug = "heading";
      const count = slugCounts[slug] || 0;
      slugCounts[slug] = count + 1;
      const id = count > 0 ? `${slug}-${count}` : slug;
      headings.push({ level: match[1].length, text, id, lineNumber: i + fmLineCount + 1, wordCount: 0 });
    }
  }
  // Compute word counts per section
  for (let h = 0; h < headings.length; h++) {
    const startLine = headings[h].lineNumber - fmLineCount; // 1-based in body
    const endLine = h + 1 < headings.length ? headings[h + 1].lineNumber - fmLineCount - 1 : lines.length;
    let words = 0;
    for (let j = startLine; j < endLine; j++) {
      words += lines[j].trim().split(/\s+/).filter(Boolean).length;
    }
    headings[h].wordCount = words;
  }
  return headings;
}
