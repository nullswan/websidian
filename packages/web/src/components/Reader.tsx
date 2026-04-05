import { useMemo, useEffect, useRef, useState } from "react";
import { createMarkdownRenderer } from "../lib/markdown.js";
import mermaid from "mermaid";

mermaid.initialize({ startOnLoad: false, theme: "dark" });

interface ReaderProps {
  content: string;
  filePath: string;
  onNavigate: (target: string) => void;
  onSave?: (content: string) => void;
  onTagClick?: (tag: string) => void;
  searchHighlight?: string;
  scrollToLine?: number | null;
  onScrollToLineDone?: () => void;
}

/** Extract a section from markdown content by heading name */
function extractSection(content: string, heading: string): string {
  const lines = content.split("\n");
  let startIdx = -1;
  let startLevel = 0;

  for (let i = 0; i < lines.length; i++) {
    const match = /^(#{1,6})\s+(.*)/.exec(lines[i]);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim();
      if (startIdx === -1) {
        if (text.toLowerCase() === heading.toLowerCase()) {
          startIdx = i;
          startLevel = level;
        }
      } else if (level <= startLevel) {
        return lines.slice(startIdx, i).join("\n");
      }
    }
  }

  if (startIdx !== -1) return lines.slice(startIdx).join("\n");
  return content;
}

export function Reader({ content, filePath, onNavigate, onSave, onTagClick, searchHighlight, scrollToLine, onScrollToLineDone }: ReaderProps) {
  const md = useMemo(() => createMarkdownRenderer(), []);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse and strip frontmatter for rendering
  const { body, properties } = useMemo(() => {
    const fmMatch = /^---[\t ]*\r?\n([\s\S]*?)\n---[\t ]*(?:\r?\n|$)/.exec(content);
    if (!fmMatch) return { body: content, properties: [] as Array<{ key: string; value: string }> };
    const yaml = fmMatch[1];
    const props: Array<{ key: string; value: string }> = [];
    for (const line of yaml.split("\n")) {
      const kv = line.match(/^(\w[\w-]*):\s*(.*)/);
      if (kv) {
        let val = kv[2].trim();
        if (val.startsWith("[")) val = val.replace(/^\[|\]$/g, "").trim();
        props.push({ key: kv[1], value: val });
      } else if (line.match(/^\s+-\s/) && props.length > 0) {
        // Continuation of a YAML array
        const item = line.replace(/^\s+-\s/, "").trim();
        const last = props[props.length - 1];
        last.value = last.value ? `${last.value}, ${item}` : item;
      }
    }
    return { body: content.slice(fmMatch[0].length), properties: props };
  }, [content]);
  const [propsCollapsed, setPropsCollapsed] = useState(false);

  const html = useMemo(() => md.render(body), [md, body]);

  // Track content ref for checkbox toggling
  const contentRef = useRef(content);
  contentRef.current = content;

  // Set innerHTML via ref so React doesn't own the DOM content
  // (dangerouslySetInnerHTML would overwrite hydrated embeds on re-renders)
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.innerHTML = html;
      // Enable checkboxes for interactive toggling
      containerRef.current.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((cb, idx) => {
        cb.disabled = false;
        cb.dataset.idx = String(idx);
        cb.style.cursor = "pointer";
      });

      // Add fold toggles and anchor links to headings
      const noteName = filePath.replace(/\.md$/, "").split("/").pop() || "";
      const headings = containerRef.current.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6");
      for (const heading of headings) {
        const level = parseInt(heading.tagName[1], 10);
        heading.style.position = "relative";
        heading.style.cursor = "pointer";

        const arrow = document.createElement("span");
        arrow.className = "heading-fold-arrow";
        arrow.textContent = "▶";
        arrow.style.cssText = "position: absolute; left: -20px; top: 50%; transform: translateY(-50%) rotate(90deg); font-size: 10px; color: #555; opacity: 0; transition: opacity 0.15s, transform 0.15s; cursor: pointer; user-select: none;";
        arrow.dataset.folded = "false";
        heading.prepend(arrow);

        // Anchor copy link — appears on right side on hover
        const headingText = heading.textContent?.replace(/^▶\s*/, "").trim() || "";
        const anchor = document.createElement("span");
        anchor.className = "heading-anchor";
        anchor.textContent = "#";
        anchor.title = `Copy link to ${headingText}`;
        anchor.style.cssText = "position: absolute; right: -24px; top: 50%; transform: translateY(-50%); font-size: 14px; color: #555; opacity: 0; transition: opacity 0.15s; cursor: pointer; user-select: none; font-weight: normal;";
        heading.appendChild(anchor);

        anchor.addEventListener("click", (e) => {
          e.stopPropagation();
          const link = `[[${noteName}#${headingText}]]`;
          navigator.clipboard.writeText(link);
          anchor.textContent = "✓";
          anchor.style.color = "#7f6df2";
          setTimeout(() => { anchor.textContent = "#"; anchor.style.color = "#555"; }, 1500);
        });

        // Show arrow and anchor on heading hover
        heading.addEventListener("mouseenter", () => { arrow.style.opacity = "1"; anchor.style.opacity = "1"; });
        heading.addEventListener("mouseleave", () => {
          if (arrow.dataset.folded === "false") arrow.style.opacity = "0";
          anchor.style.opacity = "0";
        });

        // Click to fold/unfold
        arrow.addEventListener("click", (e) => {
          e.stopPropagation();
          const isFolded = arrow.dataset.folded === "true";

          // Collect siblings until next heading of equal or higher level
          let sibling = heading.nextElementSibling as HTMLElement | null;
          while (sibling) {
            if (/^H[1-6]$/.test(sibling.tagName)) {
              const sibLevel = parseInt(sibling.tagName[1], 10);
              if (sibLevel <= level) break;
            }
            sibling.style.display = isFolded ? "" : "none";
            sibling = sibling.nextElementSibling as HTMLElement | null;
          }

          arrow.dataset.folded = isFolded ? "false" : "true";
          arrow.style.transform = isFolded
            ? "translateY(-50%) rotate(90deg)"
            : "translateY(-50%) rotate(0deg)";
          arrow.style.opacity = "1";
          arrow.style.color = isFolded ? "#555" : "#7f6df2";
        });
      }

      // Add language labels and copy buttons to code blocks
      containerRef.current.querySelectorAll<HTMLElement>("pre").forEach((pre) => {
        pre.style.position = "relative";
        const code = pre.querySelector("code");

        // Language label
        const langClass = code?.className.match(/language-(\w+)/);
        if (langClass) {
          const label = document.createElement("span");
          label.textContent = langClass[1];
          label.style.cssText = "position: absolute; top: 6px; left: 8px; font-size: 10px; color: #555; text-transform: uppercase; letter-spacing: 0.5px; user-select: none;";
          pre.appendChild(label);
        }

        // Copy button
        const btn = document.createElement("button");
        btn.textContent = "Copy";
        btn.style.cssText = "position: absolute; top: 6px; right: 6px; padding: 2px 8px; font-size: 11px; background: #333; color: #aaa; border: 1px solid #444; border-radius: 4px; cursor: pointer; opacity: 0; transition: opacity 0.15s;";
        btn.addEventListener("click", () => {
          if (code) {
            navigator.clipboard.writeText(code.textContent || "");
            btn.textContent = "Copied!";
            btn.style.color = "#7f6df2";
            setTimeout(() => { btn.textContent = "Copy"; btn.style.color = "#aaa"; }, 1500);
          }
        });
        pre.addEventListener("mouseenter", () => { btn.style.opacity = "1"; });
        pre.addEventListener("mouseleave", () => { btn.style.opacity = "0"; });
        pre.appendChild(btn);
      });
    }
  }, [html, filePath]);

  // Hydrate note embeds after html is set
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const embeds = container.querySelectorAll<HTMLElement>(".embed-note[data-target]");
    if (embeds.length === 0) return;

    let cancelled = false;

    for (const embedEl of embeds) {
      const target = embedEl.dataset.target;
      if (!target) continue;

      const from = filePath;
      fetch(`/api/vault/resolve?target=${encodeURIComponent(target)}&from=${encodeURIComponent(from)}`, { credentials: "include" })
        .then((r) => r.json())
        .then((data) => {
          if (cancelled || !data.resolved) return;
          return fetch(`/api/vault/file?path=${encodeURIComponent(data.resolved)}`, { credentials: "include" })
            .then((r) => r.json())
            .then((fileData) => {
              if (cancelled || fileData.error) return;
              let embedContent = fileData.content;
              const fmMatch = /^---[\t ]*\r?\n[\s\S]*?\n---[\t ]*(?:\r?\n|$)/.exec(embedContent);
              if (fmMatch) embedContent = embedContent.slice(fmMatch[0].length);

              const hashIdx = target.indexOf("#");
              if (hashIdx !== -1) {
                const heading = target.slice(hashIdx + 1).replace(/\^.*$/, "");
                if (heading) {
                  embedContent = extractSection(embedContent, heading);
                }
              }

              const embedHtml = md.render(embedContent);
              embedEl.innerHTML = `<div class="embed-header" style="font-size: 11px; color: #666; padding: 4px 0 2px; border-bottom: 1px solid #333; margin-bottom: 6px;">${data.resolved.replace(/\.md$/, "")}</div>${embedHtml}`;
              embedEl.style.borderLeft = "2px solid #7f6df2";
              embedEl.style.paddingLeft = "12px";
              embedEl.style.margin = "8px 0";
              embedEl.style.opacity = "0.9";
            });
        })
        .catch(() => {
          if (!cancelled) {
            embedEl.innerHTML = `<span style="color: #f88; font-size: 12px;">Failed to load: ${target}</span>`;
          }
        });
    }

    return () => { cancelled = true; };
  }, [html, filePath, md]);

  // Hydrate image embeds — resolve short names like ![[diagram.png]] via vault search
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const imgs = container.querySelectorAll<HTMLImageElement>("img.embed-img[data-target]");
    if (imgs.length === 0) return;

    let cancelled = false;
    for (const img of imgs) {
      const target = img.dataset.target;
      if (!target) continue;
      fetch(`/api/vault/resolve?target=${encodeURIComponent(target)}&from=${encodeURIComponent(filePath)}`, { credentials: "include" })
        .then((r) => r.json())
        .then((data) => {
          if (cancelled) return;
          const resolved = data.resolved || target;
          img.src = `/api/vault/raw?path=${encodeURIComponent(resolved)}`;
        })
        .catch(() => {
          if (!cancelled) {
            img.src = `/api/vault/raw?path=${encodeURIComponent(target)}`;
          }
        });
    }
    return () => { cancelled = true; };
  }, [html, filePath]);

  // Hydrate mermaid diagrams after render
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const placeholders = container.querySelectorAll<HTMLElement>(".mermaid-placeholder");
    if (placeholders.length === 0) return;

    let cancelled = false;
    (async () => {
      for (const el of placeholders) {
        if (cancelled) return;
        const code = el.dataset.mermaid;
        if (!code) continue;
        try {
          const id = `mermaid-${Math.random().toString(36).slice(2, 8)}`;
          const { svg } = await mermaid.render(id, code);
          if (!cancelled) {
            el.innerHTML = svg;
            el.classList.add("mermaid-rendered");
          }
        } catch {
          if (!cancelled) {
            el.style.color = "#f88";
            el.style.fontSize = "12px";
            el.textContent = "Mermaid diagram error";
          }
        }
      }
    })();

    return () => { cancelled = true; };
  }, [html]);

  // Highlight search matches in rendered content
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Clean up previous highlights
    const existing = container.querySelectorAll("mark.search-highlight");
    for (const el of existing) {
      const parent = el.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(el.textContent ?? ""), el);
        parent.normalize();
      }
    }

    if (!searchHighlight || !searchHighlight.trim()) return;

    const query = searchHighlight.trim().toLowerCase();
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    const matches: { node: Text; index: number }[] = [];

    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      const text = node.textContent ?? "";
      let idx = text.toLowerCase().indexOf(query);
      while (idx !== -1) {
        matches.push({ node, index: idx });
        idx = text.toLowerCase().indexOf(query, idx + query.length);
      }
    }

    // Wrap matches in <mark> — iterate in reverse to keep indices stable
    let firstMark: HTMLElement | null = null;
    for (let i = matches.length - 1; i >= 0; i--) {
      const { node, index } = matches[i];
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + query.length);
      const mark = document.createElement("mark");
      mark.className = "search-highlight";
      mark.style.background = "rgba(230, 153, 74, 0.3)";
      mark.style.color = "#e6994a";
      mark.style.borderRadius = "2px";
      mark.style.padding = "0 1px";
      range.surroundContents(mark);
      firstMark = mark;
    }

    // Scroll first match into view
    if (firstMark) {
      requestAnimationFrame(() => {
        firstMark?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
  }, [html, searchHighlight]);

  // Hover preview for wikilinks
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let previewEl: HTMLDivElement | null = null;
    let hoverTimer: ReturnType<typeof setTimeout> | null = null;
    let currentLink: HTMLElement | null = null;

    const removePreview = () => {
      if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
      if (previewEl) { previewEl.remove(); previewEl = null; }
      currentLink = null;
    };

    const handleMouseOver = (e: Event) => {
      const target = (e.target as HTMLElement).closest<HTMLAnchorElement>("a.wikilink");
      if (!target || target === currentLink) return;
      removePreview();
      currentLink = target;

      hoverTimer = setTimeout(() => {
        const linkTarget = target.dataset.target;
        if (!linkTarget) return;

        fetch(`/api/vault/resolve?target=${encodeURIComponent(linkTarget)}&from=${encodeURIComponent(filePath)}`, { credentials: "include" })
          .then(r => r.json())
          .then(data => {
            if (!data.resolved || currentLink !== target) return;
            return fetch(`/api/vault/file?path=${encodeURIComponent(data.resolved)}`, { credentials: "include" })
              .then(r => r.json())
              .then(fileData => {
                if (fileData.error || currentLink !== target) return;
                let previewContent = fileData.content;
                const fmMatch = /^---[\t ]*\r?\n[\s\S]*?\n---[\t ]*(?:\r?\n|$)/.exec(previewContent);
                if (fmMatch) previewContent = previewContent.slice(fmMatch[0].length);
                // Truncate to first ~800 chars for preview
                if (previewContent.length > 800) previewContent = previewContent.slice(0, 800) + "\n\n...";

                const previewHtml = md.render(previewContent);
                previewEl = document.createElement("div");
                previewEl.className = "hover-preview";
                previewEl.innerHTML = previewHtml;

                // Position near the link
                const rect = target.getBoundingClientRect();
                const containerRect = container.getBoundingClientRect();
                previewEl.style.position = "absolute";
                previewEl.style.left = `${rect.left - containerRect.left}px`;
                previewEl.style.top = `${rect.bottom - containerRect.top + 4}px`;
                container.appendChild(previewEl);

                // Flip up if it goes below viewport
                const previewRect = previewEl.getBoundingClientRect();
                if (previewRect.bottom > window.innerHeight - 20) {
                  previewEl.style.top = `${rect.top - containerRect.top - previewRect.height - 4}px`;
                }
              });
          })
          .catch(() => {});
      }, 300);
    };

    const handleMouseOut = (e: Event) => {
      const related = (e as MouseEvent).relatedTarget as HTMLElement | null;
      if (related && (related.closest(".hover-preview") || related.closest("a.wikilink"))) return;
      removePreview();
    };

    container.addEventListener("mouseover", handleMouseOver);
    container.addEventListener("mouseout", handleMouseOut);
    return () => {
      removePreview();
      container.removeEventListener("mouseover", handleMouseOver);
      container.removeEventListener("mouseout", handleMouseOut);
    };
  }, [html, filePath, md]);

  const handleClick = (e: React.MouseEvent) => {
    // Handle wikilink clicks
    const link = (e.target as HTMLElement).closest<HTMLAnchorElement>(
      "a.wikilink",
    );
    if (link) {
      e.preventDefault();
      const noteTarget = link.dataset.target;
      if (noteTarget) onNavigate(noteTarget);
      return;
    }

    // Handle tag clicks
    const tag = (e.target as HTMLElement).closest<HTMLSpanElement>("span.tag[data-tag]");
    if (tag && tag.dataset.tag && onTagClick) {
      onTagClick(tag.dataset.tag);
      return;
    }

    // Handle checkbox toggles
    const checkbox = e.target as HTMLInputElement;
    if (checkbox.tagName === "INPUT" && checkbox.type === "checkbox" && checkbox.dataset.idx && onSave) {
      const idx = parseInt(checkbox.dataset.idx, 10);
      const raw = contentRef.current;
      const lines = raw.split("\n");
      let cbCount = 0;
      for (let i = 0; i < lines.length; i++) {
        const match = /^(\s*- \[)([ xX])(\].*)$/.exec(lines[i]);
        if (match) {
          if (cbCount === idx) {
            const nowChecked = checkbox.checked;
            lines[i] = match[1] + (nowChecked ? "x" : " ") + match[3];
            const updated = lines.join("\n");
            onSave(updated);
            break;
          }
          cbCount++;
        }
      }
    }
  };

  return (
    <>
      {properties.length > 0 && (
        <div style={{
          background: "#252526",
          border: "1px solid #333",
          borderRadius: 6,
          margin: "0 0 12px 0",
          overflow: "hidden",
        }}>
          <div
            onClick={() => setPropsCollapsed((c) => !c)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              cursor: "pointer",
              fontSize: 11,
              color: "#888",
              textTransform: "uppercase",
              letterSpacing: 1,
              userSelect: "none",
            }}
          >
            <span style={{ transform: propsCollapsed ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 0.15s", fontSize: 8 }}>▼</span>
            Properties
          </div>
          {!propsCollapsed && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <tbody>
                {properties.map((p) => (
                  <tr key={p.key} style={{ borderTop: "1px solid #333" }}>
                    <td style={{ padding: "4px 12px", color: "#7f6df2", width: 100, verticalAlign: "top" }}>{p.key}</td>
                    <td style={{ padding: "4px 12px", color: "#ccc" }}>{p.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      <div
        ref={containerRef}
        className="reader-view"
        onClick={handleClick}
      />
      {scrollToLine != null && (
        <ScrollToLineEffect
          containerRef={containerRef}
          line={scrollToLine}
          totalLines={content.split("\n").length}
          onDone={onScrollToLineDone}
        />
      )}
    </>
  );
}

/** Scrolls the reader to approximately the given source line */
function ScrollToLineEffect({
  containerRef,
  line,
  totalLines,
  onDone,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  line: number;
  totalLines: number;
  onDone?: () => void;
}) {
  useEffect(() => {
    if (!containerRef.current || !line) return;
    const el = containerRef.current;
    // Walk up to find the scrollable ancestor
    let scroller: Element | null = el.parentElement;
    while (scroller && scroller.scrollHeight <= scroller.clientHeight) {
      scroller = scroller.parentElement;
    }
    if (!scroller) return;

    // Ratio-based scroll: approximate source line position in rendered content
    const ratio = Math.max(0, (line - 1)) / Math.max(1, totalLines);
    const scrollTarget = ratio * scroller.scrollHeight;

    requestAnimationFrame(() => {
      scroller.scrollTo({ top: scrollTarget, behavior: "smooth" });
      onDone?.();
    });
  }, [containerRef, line, totalLines, onDone]);

  return null;
}
