import { useMemo, useState, useEffect, useRef } from "react";

interface Heading {
  level: number;
  text: string;
  id: string;
}

interface OutlineProps {
  content: string;
  onScrollToHeading?: (heading: string, level: number) => void;
}

export function Outline({ content, onScrollToHeading }: OutlineProps) {
  const headings = useMemo(() => extractHeadings(content), [content]);
  const [activeIdx, setActiveIdx] = useState(-1);
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

  return (
    <div style={{ padding: "4px 12px 8px" }}>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, position: "relative" }}>
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
        {headings.map((h, i) => (
          <li key={i}>
            <div
              style={{
                paddingLeft: (h.level - minLevel) * 12,
                padding: `2px 0 2px ${(h.level - minLevel) * 12}px`,
                fontSize: 12,
                color: i === activeIdx
                  ? "var(--accent-color)"
                  : h.level === 1 ? "var(--text-primary)" : h.level === 2 ? "var(--text-secondary)" : "var(--text-muted)",
                cursor: "pointer",
                borderRadius: 3,
                fontWeight: i === activeIdx ? 600 : "normal",
                borderLeft: i === activeIdx ? "2px solid var(--accent-color)" : "2px solid transparent",
                marginLeft: -2,
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
              {h.text}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function extractHeadings(content: string): Heading[] {
  // Strip frontmatter
  const fmMatch = /^---[\t ]*\r?\n[\s\S]*?\n---[\t ]*(?:\r?\n|$)/.exec(content);
  const body = fmMatch ? content.slice(fmMatch[0].length) : content;

  const headings: Heading[] = [];
  const slugCounts: Record<string, number> = {};
  const lines = body.split("\n");
  for (const line of lines) {
    const match = /^(#{1,6})\s+(.+)$/.exec(line);
    if (match) {
      const text = match[2].trim().replace(/\s*\^[\w-]+$/, "");
      let slug = text.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/^-+|-+$/g, "");
      if (!slug) slug = "heading";
      const count = slugCounts[slug] || 0;
      slugCounts[slug] = count + 1;
      const id = count > 0 ? `${slug}-${count}` : slug;
      headings.push({ level: match[1].length, text, id });
    }
  }
  return headings;
}
