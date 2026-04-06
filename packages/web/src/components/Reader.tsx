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
        arrow.style.cssText = "position: absolute; left: -20px; top: 50%; transform: translateY(-50%) rotate(90deg); font-size: 10px; color: var(--text-faint); opacity: 0; transition: opacity 0.15s, transform 0.15s; cursor: pointer; user-select: none;";
        arrow.dataset.folded = "false";
        heading.prepend(arrow);

        // Anchor copy link — appears on right side on hover
        const headingText = heading.textContent?.replace(/^▶\s*/, "").trim() || "";
        const anchor = document.createElement("span");
        anchor.className = "heading-anchor";
        anchor.textContent = "#";
        anchor.title = `Copy link to ${headingText}`;
        anchor.style.cssText = "position: absolute; right: -24px; top: 50%; transform: translateY(-50%); font-size: 14px; color: var(--text-faint); opacity: 0; transition: opacity 0.15s; cursor: pointer; user-select: none; font-weight: normal;";
        heading.appendChild(anchor);

        anchor.addEventListener("click", (e) => {
          e.stopPropagation();
          const link = `[[${noteName}#${headingText}]]`;
          navigator.clipboard.writeText(link);
          anchor.textContent = "✓";
          anchor.style.color = "var(--accent-color)";
          setTimeout(() => { anchor.textContent = "#"; anchor.style.color = "var(--text-faint)"; }, 1500);
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
          arrow.style.color = isFolded ? "var(--text-faint)" : "var(--accent-color)";
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
          label.style.cssText = "position: absolute; top: 6px; left: 8px; font-size: 10px; color: var(--text-faint); text-transform: uppercase; letter-spacing: 0.5px; user-select: none;";
          pre.appendChild(label);
        }

        // Copy button
        const btn = document.createElement("button");
        btn.textContent = "Copy";
        btn.style.cssText = "position: absolute; top: 6px; right: 6px; padding: 2px 8px; font-size: 11px; background: var(--border-color); color: var(--text-secondary); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; opacity: 0; transition: opacity 0.15s;";
        btn.addEventListener("click", () => {
          if (code) {
            navigator.clipboard.writeText(code.textContent || "");
            btn.textContent = "Copied!";
            btn.style.color = "var(--accent-color)";
            setTimeout(() => { btn.textContent = "Copy"; btn.style.color = "var(--text-secondary)"; }, 1500);
          }
        });
        pre.addEventListener("mouseenter", () => { btn.style.opacity = "1"; });
        pre.addEventListener("mouseleave", () => { btn.style.opacity = "0"; });
        pre.appendChild(btn);
      });
    }
  }, [html, filePath]);

  // Mark unresolved wikilinks with dimmed styling
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const links = container.querySelectorAll<HTMLAnchorElement>("a.wikilink[data-target]");
    if (links.length === 0) return;

    // Collect unique targets
    const targets = new Set<string>();
    for (const link of links) {
      targets.add(link.dataset.target!);
    }

    // Check each target (could batch, but resolve endpoint is per-target)
    const controller = new AbortController();
    Promise.all(
      [...targets].map((target) =>
        fetch(`/api/vault/resolve?target=${encodeURIComponent(target)}&from=${encodeURIComponent(filePath)}`, {
          credentials: "include",
          signal: controller.signal,
        })
          .then((r) => r.json())
          .then((data) => ({ target, resolved: !!data.resolved }))
          .catch(() => ({ target, resolved: false })),
      ),
    ).then((results) => {
      const unresolvedSet = new Set(results.filter((r) => !r.resolved).map((r) => r.target));
      for (const link of links) {
        if (unresolvedSet.has(link.dataset.target!)) {
          link.classList.add("wikilink-unresolved");
        }
      }
    });

    return () => controller.abort();
  }, [html, filePath]);

  // Footnote hover preview — show footnote content on hover over [^n] references
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const refs = container.querySelectorAll<HTMLElement>("sup.footnote-ref");
    if (refs.length === 0) return;

    let previewEl: HTMLDivElement | null = null;
    let activeRef: HTMLElement | null = null;

    const removePreview = () => {
      previewEl?.remove();
      previewEl = null;
      activeRef = null;
    };

    const handleMouseEnter = (e: Event) => {
      const sup = (e.currentTarget as HTMLElement);
      const anchor = sup.querySelector("a[href^='#fn']");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href) return;
      const fnId = href.replace("#", "");
      const fnLi = container.querySelector(`li#${fnId}`);
      if (!fnLi) return;

      removePreview();
      activeRef = sup;
      previewEl = document.createElement("div");
      previewEl.className = "hover-preview";
      // Clone footnote content, removing backref links
      const clone = fnLi.cloneNode(true) as HTMLElement;
      clone.querySelectorAll(".footnote-backref").forEach((el) => el.remove());
      previewEl.innerHTML = clone.innerHTML;

      const rect = sup.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      previewEl.style.position = "absolute";
      previewEl.style.left = `${rect.left - containerRect.left}px`;
      previewEl.style.top = `${rect.bottom - containerRect.top + 4}px`;
      container.appendChild(previewEl);

      // Reposition if it overflows viewport
      const previewRect = previewEl.getBoundingClientRect();
      if (previewRect.bottom > window.innerHeight - 20) {
        previewEl.style.top = `${rect.top - containerRect.top - previewRect.height - 4}px`;
      }
      if (previewRect.right > window.innerWidth - 20) {
        previewEl.style.left = `${Math.max(0, window.innerWidth - 20 - previewRect.width - containerRect.left)}px`;
      }
    };

    const handleMouseLeave = (e: Event) => {
      const related = (e as MouseEvent).relatedTarget as HTMLElement | null;
      if (related && (related.closest(".hover-preview") || related.closest("sup.footnote-ref"))) return;
      removePreview();
    };

    for (const ref of refs) {
      ref.addEventListener("mouseenter", handleMouseEnter);
      ref.addEventListener("mouseleave", handleMouseLeave);
    }

    // Also dismiss when leaving the preview itself
    const containerLeave = (e: Event) => {
      const related = (e as MouseEvent).relatedTarget as HTMLElement | null;
      if (related && (related.closest(".hover-preview") || related.closest("sup.footnote-ref"))) return;
      removePreview();
    };

    return () => {
      removePreview();
      for (const ref of refs) {
        ref.removeEventListener("mouseenter", handleMouseEnter);
        ref.removeEventListener("mouseleave", handleMouseLeave);
      }
    };
  }, [html]);

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
                const fragment = target.slice(hashIdx + 1);
                if (fragment.startsWith("^")) {
                  // Block reference: find the line containing ^blockid
                  const blockId = fragment.slice(1);
                  const blockLine = embedContent.split("\n").find((l: string) => l.includes(`^${blockId}`));
                  if (blockLine) {
                    embedContent = blockLine.replace(/\s*\^[\w-]+\s*$/, "").trim();
                  }
                } else {
                  const heading = fragment.replace(/\^.*$/, "");
                  if (heading) {
                    embedContent = extractSection(embedContent, heading);
                  }
                }
              }

              const embedHtml = md.render(embedContent);
              embedEl.innerHTML = `<div class="embed-header" style="font-size: 11px; color: var(--accent-color); padding: 4px 0 2px; border-bottom: 1px solid var(--border-color); margin-bottom: 6px; cursor: pointer; opacity: 0.7;" onmouseenter="this.style.opacity='1'" onmouseleave="this.style.opacity='0.7'">${data.resolved.replace(/\.md$/, "")}</div>${embedHtml}`;
              embedEl.style.borderLeft = "2px solid var(--accent-color)";
              embedEl.style.paddingLeft = "12px";
              embedEl.style.margin = "8px 0";
              embedEl.style.opacity = "0.9";

              // Collapse if content is tall
              requestAnimationFrame(() => {
                if (embedEl.scrollHeight > 320) {
                  embedEl.classList.add("embed-collapsed");
                  const btn = document.createElement("button");
                  btn.className = "embed-expand-btn";
                  btn.textContent = "Show more";
                  btn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    embedEl.classList.remove("embed-collapsed");
                    btn.remove();
                  });
                  embedEl.appendChild(btn);
                }
              });
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

  // Hydrate audio, video, and PDF embeds — resolve short names via vault search
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const mediaEls = container.querySelectorAll<HTMLElement>("audio[data-target], video[data-target], iframe[data-target]");
    if (mediaEls.length === 0) return;

    let cancelled = false;
    for (const el of mediaEls) {
      const target = el.dataset.target;
      if (!target) continue;
      fetch(`/api/vault/resolve?target=${encodeURIComponent(target)}&from=${encodeURIComponent(filePath)}`, { credentials: "include" })
        .then((r) => r.json())
        .then((data) => {
          if (cancelled) return;
          const resolved = data.resolved || target;
          const url = `/api/vault/raw?path=${encodeURIComponent(resolved)}`;
          if (el.tagName === "IFRAME") {
            (el as HTMLIFrameElement).src = url;
          } else {
            const source = el.querySelector("source[data-target]") as HTMLSourceElement | null;
            if (source) {
              source.src = url;
              (el as HTMLMediaElement).load();
            }
          }
        })
        .catch(() => {});
    }
    return () => { cancelled = true; };
  }, [html, filePath]);

  // Hydrate unresolved wikilinks — dim links to non-existent notes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const links = container.querySelectorAll<HTMLAnchorElement>("a.wikilink[data-target]");
    if (links.length === 0) return;

    let cancelled = false;
    for (const link of links) {
      const target = link.dataset.target;
      if (!target) continue;
      fetch(`/api/vault/resolve?target=${encodeURIComponent(target)}&from=${encodeURIComponent(filePath)}`, { credentials: "include" })
        .then((r) => r.json())
        .then((data) => {
          if (cancelled) return;
          if (!data.resolved) {
            link.classList.add("wikilink-unresolved");
          }
        })
        .catch(() => {});
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

        // Show loading preview immediately
        previewEl = document.createElement("div");
        previewEl.className = "hover-preview";
        previewEl.innerHTML = '<div style="padding:8px;color:var(--text-faint);font-size:12px;">Loading...</div>';
        const rect = target.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        previewEl.style.position = "absolute";
        previewEl.style.left = `${rect.left - containerRect.left}px`;
        previewEl.style.top = `${rect.bottom - containerRect.top + 4}px`;
        container.appendChild(previewEl);

        fetch(`/api/vault/resolve?target=${encodeURIComponent(linkTarget)}&from=${encodeURIComponent(filePath)}`, { credentials: "include" })
          .then(r => r.json())
          .then(data => {
            if (!data.resolved || currentLink !== target || !previewEl) return;
            return fetch(`/api/vault/file?path=${encodeURIComponent(data.resolved)}`, { credentials: "include" })
              .then(r => r.json())
              .then(fileData => {
                if (fileData.error || currentLink !== target || !previewEl) return;
                let previewContent = fileData.content;
                const fmMatch = /^---[\t ]*\r?\n[\s\S]*?\n---[\t ]*(?:\r?\n|$)/.exec(previewContent);
                if (fmMatch) previewContent = previewContent.slice(fmMatch[0].length);
                if (previewContent.length > 800) previewContent = previewContent.slice(0, 800) + "\n\n...";

                previewEl.innerHTML = md.render(previewContent);

                // Reposition if it overflows viewport
                const previewRect = previewEl.getBoundingClientRect();
                if (previewRect.bottom > window.innerHeight - 20) {
                  previewEl.style.top = `${rect.top - containerRect.top - previewRect.height - 4}px`;
                }
                if (previewRect.right > window.innerWidth - 20) {
                  previewEl.style.left = `${Math.max(0, window.innerWidth - 20 - previewRect.width - containerRect.left)}px`;
                }
              });
          })
          .catch(() => { if (previewEl) previewEl.innerHTML = '<div style="padding:8px;color:var(--text-faint);font-size:12px;">Preview unavailable</div>'; });
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

    // Handle embed header clicks (navigate to embedded note)
    const embedHeader = (e.target as HTMLElement).closest<HTMLElement>(".embed-header");
    if (embedHeader) {
      const embed = embedHeader.closest<HTMLElement>(".embed-note[data-target]");
      if (embed?.dataset.target) {
        onNavigate(embed.dataset.target);
        return;
      }
    }

    // Handle checkbox toggles
    const checkbox = e.target as HTMLInputElement;
    if (checkbox.tagName === "INPUT" && checkbox.type === "checkbox" && checkbox.dataset.idx && onSave) {
      const idx = parseInt(checkbox.dataset.idx, 10);
      const raw = contentRef.current;
      const lines = raw.split("\n");
      let cbCount = 0;
      for (let i = 0; i < lines.length; i++) {
        const match = /^(\s*- \[)([ xX/\->!?*])(\].*)$/.exec(lines[i]);
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
          background: "var(--bg-secondary)",
          border: "1px solid var(--border-color)",
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
              color: "var(--text-muted)",
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
                  <tr key={p.key} style={{ borderTop: "1px solid var(--border-color)" }}>
                    <td style={{ padding: "4px 12px", color: "var(--accent-color)", width: 100, verticalAlign: "top" }}>{p.key}</td>
                    <td style={{ padding: "4px 12px", color: "var(--text-primary)" }}>{p.value}</td>
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
