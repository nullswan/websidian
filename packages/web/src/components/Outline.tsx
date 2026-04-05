import { useMemo, useState, useEffect, useRef } from "react";

interface Heading {
  level: number;
  text: string;
  id: string;
}

interface OutlineProps {
  content: string;
}

export function Outline({ content }: OutlineProps) {
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

  return (
    <div style={{ padding: "4px 12px 8px" }}>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {headings.map((h, i) => (
          <li key={i}>
            <div
              style={{
                paddingLeft: (h.level - 1) * 12,
                padding: `2px 0 2px ${(h.level - 1) * 12}px`,
                fontSize: 12,
                color: i === activeIdx
                  ? "#7f6df2"
                  : h.level === 1 ? "#ddd" : h.level === 2 ? "#bbb" : "#888",
                cursor: "pointer",
                borderRadius: 3,
                fontWeight: i === activeIdx ? 600 : "normal",
                borderLeft: i === activeIdx ? "2px solid #7f6df2" : "2px solid transparent",
                marginLeft: -2,
              }}
              onClick={() => {
                // Find by text content for accurate scrolling
                const allHeadings = document.querySelectorAll(
                  ".reader-view h1, .reader-view h2, .reader-view h3, .reader-view h4, .reader-view h5, .reader-view h6",
                );
                for (const heading of allHeadings) {
                  const text = heading.textContent?.replace(/^▶/, "").trim();
                  if (text === h.text) {
                    heading.scrollIntoView({ behavior: "smooth", block: "start" });
                    setActiveIdx(i);
                    break;
                  }
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
  const lines = body.split("\n");
  for (const line of lines) {
    const match = /^(#{1,6})\s+(.+)$/.exec(line);
    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2].trim(),
        id: match[2].trim().toLowerCase().replace(/\s+/g, "-"),
      });
    }
  }
  return headings;
}
