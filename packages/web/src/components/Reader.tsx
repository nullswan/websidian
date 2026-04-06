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
  scrollToHeading?: string | null;
  onScrollToHeadingDone?: () => void;
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

export function Reader({ content, filePath, onNavigate, onSave, onTagClick, searchHighlight, scrollToLine, onScrollToLineDone, scrollToHeading, onScrollToHeadingDone }: ReaderProps) {
  const md = useMemo(() => createMarkdownRenderer(), []);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse cssclasses from frontmatter
  const cssClasses = useMemo(() => {
    const fmMatch = content.match(/^---[\t ]*\r?\n([\s\S]*?)\n---/);
    if (!fmMatch) return "";
    const classMatch = fmMatch[1].match(/cssclasses?:\s*(.+)/i);
    if (!classMatch) return "";
    return classMatch[1].split(/[,\s]+/).filter(Boolean).join(" ");
  }, [content]);

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

        // Line numbers for code blocks with 4+ lines
        if (code) {
          const lines = (code.textContent ?? "").split("\n");
          if (lines.length >= 4) {
            // Remove trailing empty line from trailing \n
            if (lines[lines.length - 1] === "") lines.pop();
            const gutter = document.createElement("div");
            gutter.className = "code-line-numbers";
            gutter.style.cssText = "position: absolute; left: 0; top: 12px; width: 32px; text-align: right; font-size: 11px; color: var(--text-faint); opacity: 0.4; user-select: none; font-family: monospace; line-height: inherit; pointer-events: none;";
            gutter.innerHTML = lines.map((_, i) => `<div>${i + 1}</div>`).join("");
            // Match code line-height
            const codeStyle = window.getComputedStyle(code);
            gutter.style.lineHeight = codeStyle.lineHeight;
            pre.appendChild(gutter);
            code.style.paddingLeft = "32px";
          }
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
        pre.addEventListener("mouseenter", () => { btn.style.opacity = "1"; if (runBtn) runBtn.style.opacity = "1"; });
        pre.addEventListener("mouseleave", () => { btn.style.opacity = "0"; if (runBtn) runBtn.style.opacity = "0"; });
        pre.appendChild(btn);

        // Run button for JavaScript and HTML code blocks
        const lang = langClass?.[1]?.toLowerCase();
        let runBtn: HTMLButtonElement | null = null;
        if (lang === "javascript" || lang === "js" || lang === "html" || lang === "typescript" || lang === "ts") {
          runBtn = document.createElement("button");
          runBtn.textContent = "▶ Run";
          runBtn.style.cssText = "position: absolute; top: 6px; right: 60px; padding: 2px 8px; font-size: 11px; background: rgba(127,109,242,0.15); color: var(--accent-color); border: 1px solid rgba(127,109,242,0.3); border-radius: 4px; cursor: pointer; opacity: 0; transition: opacity 0.15s;";
          const outputEl = document.createElement("div");
          outputEl.style.cssText = "display: none; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 4px; margin-top: 4px; padding: 8px; font-size: 12px; font-family: monospace; max-height: 200px; overflow: auto; white-space: pre-wrap;";
          pre.parentElement?.insertBefore(outputEl, pre.nextSibling);

          runBtn.addEventListener("click", () => {
            const source = code?.textContent || "";
            outputEl.style.display = "block";
            outputEl.innerHTML = "";

            if (lang === "html") {
              const iframe = document.createElement("iframe");
              iframe.style.cssText = "width: 100%; border: none; min-height: 100px; max-height: 300px; background: white; border-radius: 3px;";
              iframe.sandbox.add("allow-scripts");
              iframe.srcdoc = source;
              iframe.addEventListener("load", () => {
                try {
                  const h = iframe.contentDocument?.body?.scrollHeight ?? 100;
                  iframe.style.height = `${Math.min(h + 16, 300)}px`;
                } catch { /* cross-origin */ }
              });
              outputEl.appendChild(iframe);
            } else {
              // JavaScript/TypeScript — run in sandboxed function
              const logs: string[] = [];
              const mockConsole = {
                log: (...args: unknown[]) => logs.push(args.map(String).join(" ")),
                error: (...args: unknown[]) => logs.push("Error: " + args.map(String).join(" ")),
                warn: (...args: unknown[]) => logs.push("Warn: " + args.map(String).join(" ")),
                info: (...args: unknown[]) => logs.push(args.map(String).join(" ")),
              };
              try {
                const fn = new Function("console", source);
                const result = fn(mockConsole);
                if (result !== undefined && logs.length === 0) logs.push(String(result));
                outputEl.textContent = logs.length > 0 ? logs.join("\n") : "(no output)";
                outputEl.style.color = "var(--text-secondary)";
              } catch (err) {
                outputEl.textContent = String(err);
                outputEl.style.color = "#e06c75";
              }
            }
          });
          pre.appendChild(runBtn);
        }
      });
    }
  }, [html, filePath]);

  // Image captions: title attribute → <figcaption> below image
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const imgs = container.querySelectorAll<HTMLImageElement>("img[title]");
    imgs.forEach((img) => {
      const title = img.getAttribute("title");
      if (!title) return;
      // Wrap in figure if not already
      if (img.parentElement?.tagName === "FIGURE") return;
      const figure = document.createElement("figure");
      figure.style.cssText = "margin: 12px 0; text-align: center;";
      const caption = document.createElement("figcaption");
      caption.textContent = title;
      caption.style.cssText = "font-size: 0.85em; color: var(--text-faint); margin-top: 4px; font-style: italic;";
      img.parentElement?.insertBefore(figure, img);
      figure.appendChild(img);
      figure.appendChild(caption);
    });
  }, [html]);

  // Style blockquote citations — detect "— Author" or "-- Author" at end
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const blockquotes = container.querySelectorAll("blockquote");
    blockquotes.forEach((bq) => {
      const paragraphs = bq.querySelectorAll("p");
      if (paragraphs.length === 0) return;
      const lastP = paragraphs[paragraphs.length - 1];
      const text = lastP.textContent || "";
      // Match "— Source" or "-- Source" at end of blockquote
      const citMatch = text.match(/(?:^|\n)\s*(?:—|--|―)\s*(.+)$/);
      if (!citMatch) return;
      // Style the blockquote as a citation
      bq.style.borderLeftColor = "var(--accent-color)";
      bq.style.fontStyle = "italic";
      // Style the attribution line
      lastP.style.fontStyle = "normal";
      lastP.style.fontSize = "0.9em";
      lastP.style.opacity = "0.8";
      lastP.style.textAlign = "right";
      lastP.style.marginTop = "4px";
    });
  }, [html]);

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

  // Inline expand buttons for wikilinks
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const links = container.querySelectorAll<HTMLAnchorElement>("a.wikilink[data-target]");
    const btns: HTMLButtonElement[] = [];

    links.forEach((link) => {
      // Don't add to already-embedded links or unresolved
      if (link.classList.contains("wikilink-unresolved")) return;
      if (link.nextElementSibling?.classList.contains("inline-expand-btn")) return;

      const btn = document.createElement("button");
      btn.className = "inline-expand-btn";
      btn.textContent = "⊕";
      btn.style.cssText = "background: none; border: none; color: var(--accent-color); cursor: pointer; font-size: 11px; padding: 0 2px; opacity: 0; transition: opacity 0.15s; vertical-align: super;";
      btn.title = "Expand inline";

      let expanded = false;
      let embedDiv: HTMLDivElement | null = null;

      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (expanded && embedDiv) {
          embedDiv.remove();
          embedDiv = null;
          expanded = false;
          btn.textContent = "⊕";
          return;
        }
        const target = link.dataset.target!;
        try {
          const res = await fetch(`/api/vault/resolve?target=${encodeURIComponent(target)}&from=${encodeURIComponent(filePath)}`, { credentials: "include" });
          const data = await res.json();
          if (!data.resolved) return;
          const fileRes = await fetch(`/api/vault/file?path=${encodeURIComponent(data.resolved)}`, { credentials: "include" });
          const fileData = await fileRes.json();
          if (fileData.error) return;

          embedDiv = document.createElement("div");
          embedDiv.style.cssText = "margin: 8px 0; padding: 8px 12px; border-left: 3px solid var(--accent-color); background: rgba(127,109,242,0.05); border-radius: 4px; font-size: 0.9em;";
          embedDiv.innerHTML = md.render(fileData.content);
          link.parentElement?.insertBefore(embedDiv, link.nextSibling?.nextSibling || null);
          expanded = true;
          btn.textContent = "⊖";
        } catch {}
      });

      // Show button on hover
      link.addEventListener("mouseenter", () => { btn.style.opacity = "1"; });
      link.addEventListener("mouseleave", () => { if (!expanded) btn.style.opacity = "0"; });

      link.after(btn);
      btns.push(btn);
    });

    return () => {
      btns.forEach((b) => b.remove());
    };
  }, [html, filePath, md]);

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
              embedEl.innerHTML = `<div class="embed-header" style="font-size: 11px; color: var(--accent-color); padding: 4px 0 2px; border-bottom: 1px solid var(--border-color); margin-bottom: 6px; cursor: pointer; opacity: 0.7; display: flex; justify-content: space-between; align-items: center;" onmouseenter="this.style.opacity='1'" onmouseleave="this.style.opacity='0.7'"><span>${data.resolved.replace(/\.md$/, "")}</span><span class="embed-ref-badge" data-embed-path="${data.resolved}" style="font-size: 10px; color: var(--text-faint);"></span></div>${embedHtml}`;
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

  // Populate embed backlink count badges
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const badges = container.querySelectorAll<HTMLElement>(".embed-ref-badge[data-embed-path]");
    if (badges.length === 0) return;
    const controller = new AbortController();
    fetch("/api/vault/graph", { credentials: "include", signal: controller.signal })
      .then((r) => r.json())
      .then((graph: { edges: Array<{ target: string }> }) => {
        const backlinkMap = new Map<string, number>();
        for (const edge of graph.edges) {
          backlinkMap.set(edge.target, (backlinkMap.get(edge.target) ?? 0) + 1);
        }
        for (const badge of badges) {
          const path = badge.dataset.embedPath;
          if (path) {
            const count = backlinkMap.get(path) ?? 0;
            if (count > 0) badge.textContent = `${count} ref${count !== 1 ? "s" : ""}`;
          }
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [html, filePath]);

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

  // Scroll to heading after content render (e.g. from [[Note#Heading]] navigation)
  useEffect(() => {
    if (!scrollToHeading || !containerRef.current) return;
    const slug = scrollToHeading.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/^-+|-+$/g, "") || "heading";
    // Try by ID first, then text match
    const flashEl = (el: Element) => {
      el.classList.remove("heading-flash");
      void (el as HTMLElement).offsetWidth;
      el.classList.add("heading-flash");
    };
    requestAnimationFrame(() => {
      const byId = containerRef.current?.querySelector<HTMLElement>(`[id="${CSS.escape(slug)}"]`);
      if (byId) {
        byId.scrollIntoView({ behavior: "smooth", block: "start" });
        flashEl(byId);
        onScrollToHeadingDone?.();
        return;
      }
      // Fallback: text match
      const headings = containerRef.current?.querySelectorAll("h1, h2, h3, h4, h5, h6");
      if (headings) {
        for (const h of headings) {
          const text = h.textContent?.replace(/^▶\s*/, "").trim();
          if (text?.toLowerCase() === scrollToHeading.toLowerCase()) {
            h.scrollIntoView({ behavior: "smooth", block: "start" });
            flashEl(h);
            break;
          }
        }
      }
      onScrollToHeadingDone?.();
    });
  }, [html, scrollToHeading, onScrollToHeadingDone]);

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

  // Tag hover popover — show count + notes sharing the tag
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let hoverTimer: ReturnType<typeof setTimeout> | null = null;
    let popover: HTMLDivElement | null = null;
    let currentTag: HTMLElement | null = null;

    const removePopover = () => {
      if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
      if (popover) { popover.remove(); popover = null; }
      currentTag = null;
    };

    const handleOver = (e: Event) => {
      const target = (e.target as HTMLElement).closest<HTMLSpanElement>("span.tag[data-tag]");
      if (!target || target === currentTag) return;
      removePopover();
      currentTag = target;

      hoverTimer = setTimeout(() => {
        const tag = target.dataset.tag;
        if (!tag) return;

        popover = document.createElement("div");
        popover.className = "hover-preview";
        popover.style.maxWidth = "240px";
        popover.style.padding = "8px 12px";
        popover.innerHTML = '<div style="color:var(--text-faint);font-size:11px;">Loading...</div>';

        const rect = target.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        popover.style.position = "absolute";
        popover.style.left = `${rect.left - containerRect.left}px`;
        popover.style.top = `${rect.bottom - containerRect.top + 4}px`;
        container.appendChild(popover);

        fetch(`/api/vault/search?q=${encodeURIComponent("#" + tag)}`, { credentials: "include" })
          .then(r => r.json())
          .then(data => {
            if (!popover || currentTag !== target) return;
            const results = data.results ?? [];
            const count = results.length;
            let html = `<div style="font-weight:600;color:var(--accent-color);font-size:12px;margin-bottom:4px;">#${tag}</div>`;
            html += `<div style="color:var(--text-muted);font-size:11px;margin-bottom:4px;">${count} note${count !== 1 ? "s" : ""}</div>`;
            if (count > 0) {
              const shown = results.slice(0, 8);
              html += '<div style="font-size:11px;color:var(--text-secondary);line-height:1.6;">';
              for (const r of shown) {
                const name = (r.path as string).replace(/\.md$/, "").split("/").pop();
                html += `<div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${name}</div>`;
              }
              if (count > 8) html += `<div style="color:var(--text-faint);">+${count - 8} more</div>`;
              html += "</div>";
            }
            popover.innerHTML = html;

            // Reposition if overflow
            const pRect = popover.getBoundingClientRect();
            if (pRect.bottom > window.innerHeight - 20) {
              popover.style.top = `${rect.top - containerRect.top - pRect.height - 4}px`;
            }
          })
          .catch(() => { if (popover) popover.innerHTML = '<div style="color:var(--text-faint);font-size:11px;">Unavailable</div>'; });
      }, 300);
    };

    const handleOut = (e: Event) => {
      const related = (e as MouseEvent).relatedTarget as HTMLElement | null;
      if (related && (related.closest(".hover-preview") || related.closest("span.tag"))) return;
      removePopover();
    };

    container.addEventListener("mouseover", handleOver);
    container.addEventListener("mouseout", handleOut);
    return () => {
      removePopover();
      container.removeEventListener("mouseover", handleOver);
      container.removeEventListener("mouseout", handleOut);
    };
  }, [html]);

  // Image lightbox — click to zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let overlay: HTMLDivElement | null = null;

    const handleImgClick = (e: MouseEvent) => {
      const img = (e.target as HTMLElement).closest("img");
      if (!img || img.closest("a")) return; // skip linked images
      e.stopPropagation();

      overlay = document.createElement("div");
      overlay.style.cssText = "position: fixed; inset: 0; z-index: 10000; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; cursor: zoom-out; backdrop-filter: blur(4px); animation: fade-in 0.15s ease;";
      const zoomImg = document.createElement("img");
      zoomImg.src = img.src;
      zoomImg.alt = img.alt || "";
      zoomImg.style.cssText = "max-width: 90vw; max-height: 90vh; object-fit: contain; border-radius: 4px; box-shadow: 0 8px 32px rgba(0,0,0,0.5);";
      overlay.appendChild(zoomImg);

      const close = () => { overlay?.remove(); overlay = null; };
      overlay.addEventListener("click", close);
      const keyHandler = (ke: KeyboardEvent) => { if (ke.key === "Escape") { close(); document.removeEventListener("keydown", keyHandler); } };
      document.addEventListener("keydown", keyHandler);

      document.body.appendChild(overlay);
    };

    container.addEventListener("click", handleImgClick);
    return () => {
      container.removeEventListener("click", handleImgClick);
      overlay?.remove();
    };
  }, [html]);

  // Table sort on header click
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const tables = container.querySelectorAll("table");
    const cleanups: (() => void)[] = [];

    tables.forEach((table) => {
      const thead = table.querySelector("thead");
      const tbody = table.querySelector("tbody");
      if (!thead || !tbody) return;

      const ths = thead.querySelectorAll("th");
      let sortCol = -1;
      let sortAsc = true;

      ths.forEach((th, colIdx) => {
        th.style.cursor = "pointer";
        th.style.userSelect = "none";
        th.title = "Click to sort";

        const handler = () => {
          if (sortCol === colIdx) {
            sortAsc = !sortAsc;
          } else {
            sortCol = colIdx;
            sortAsc = true;
          }
          // Update indicators
          ths.forEach((h, i) => {
            const existing = h.querySelector(".sort-indicator");
            if (existing) existing.remove();
            if (i === sortCol) {
              const span = document.createElement("span");
              span.className = "sort-indicator";
              span.textContent = sortAsc ? " ▲" : " ▼";
              span.style.fontSize = "10px";
              span.style.opacity = "0.6";
              h.appendChild(span);
            }
          });
          // Sort rows
          const rows = Array.from(tbody.querySelectorAll("tr"));
          rows.sort((a, b) => {
            const aText = (a.cells[colIdx]?.textContent ?? "").trim();
            const bText = (b.cells[colIdx]?.textContent ?? "").trim();
            const aNum = parseFloat(aText);
            const bNum = parseFloat(bText);
            if (!isNaN(aNum) && !isNaN(bNum)) return sortAsc ? aNum - bNum : bNum - aNum;
            return sortAsc ? aText.localeCompare(bText) : bText.localeCompare(aText);
          });
          rows.forEach((row) => tbody.appendChild(row));
        };
        th.addEventListener("click", handler);
        cleanups.push(() => th.removeEventListener("click", handler));
      });
    });

    return () => cleanups.forEach((fn) => fn());
  }, [html]);

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

    // Handle date link clicks → open daily note
    const dateLink = (e.target as HTMLElement).closest<HTMLAnchorElement>("a.date-link[data-date]");
    if (dateLink) {
      e.preventDefault();
      const dateStr = dateLink.dataset.date;
      if (dateStr) onNavigate(`Daily Notes/${dateStr}`);
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
      {(() => {
        const total = (body.match(/^[\t ]*- \[[ x]\]/gm) ?? []).length;
        const done = (body.match(/^[\t ]*- \[x\]/gm) ?? []).length;
        if (total === 0) return null;
        const pct = Math.round((done / total) * 100);
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 12, color: "var(--text-muted)" }}>
            <div style={{ flex: 1, height: 4, borderRadius: 2, background: "var(--bg-tertiary)", overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: pct === 100 ? "#4caf50" : "var(--accent-color)", borderRadius: 2, transition: "width 0.3s" }} />
            </div>
            <span>{done}/{total} tasks</span>
          </div>
        );
      })()}
      {(() => {
        const headings = body.split("\n").filter(l => /^#{1,6}\s+/.test(l)).map(l => {
          const m = l.match(/^(#{1,6})\s+(.+)/);
          return m ? { level: m[1].length, text: m[2].replace(/\*\*|__|[*_`]/g, "").trim() } : null;
        }).filter(Boolean) as { level: number; text: string }[];
        if (headings.length < 5) return null;
        return (
          <details style={{ marginBottom: 12, background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: 6, padding: "8px 12px", fontSize: 13 }}>
            <summary style={{ cursor: "pointer", color: "var(--text-secondary)", fontWeight: 600, userSelect: "none" }}>
              Table of Contents ({headings.length})
            </summary>
            <nav style={{ marginTop: 6 }}>
              {headings.map((h, i) => (
                <div
                  key={i}
                  style={{ paddingLeft: (h.level - 1) * 16, padding: "2px 0 2px " + ((h.level - 1) * 16) + "px", cursor: "pointer", color: "var(--accent-color)", fontSize: 12 }}
                  onClick={() => {
                    const container = containerRef.current;
                    if (!container) return;
                    const headingEl = container.querySelectorAll("h1,h2,h3,h4,h5,h6");
                    for (const el of headingEl) {
                      if (el.textContent?.trim() === h.text) {
                        el.scrollIntoView({ behavior: "smooth", block: "start" });
                        break;
                      }
                    }
                  }}
                >
                  {h.text}
                </div>
              ))}
            </nav>
          </details>
        );
      })()}
      <div
        ref={containerRef}
        className={`reader-view${cssClasses ? ` ${cssClasses}` : ""}`}
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
      <FloatingTOC containerRef={containerRef} content={content} />
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

/** Floating mini-TOC on the right edge for long notes */
function FloatingTOC({ containerRef, content }: { containerRef: React.RefObject<HTMLDivElement | null>; content: string }) {
  const [headings, setHeadings] = useState<Array<{ text: string; level: number; el: Element }>>([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const timer = setTimeout(() => {
      const els = container.querySelectorAll("h1, h2, h3, h4");
      const items = Array.from(els).map((el) => ({
        text: el.textContent?.replace(/^▶\s*/, "").trim() ?? "",
        level: parseInt(el.tagName[1], 10),
        el,
      }));
      setHeadings(items);
      setVisible(items.length >= 3);
    }, 300);
    return () => clearTimeout(timer);
  }, [content, containerRef]);

  useEffect(() => {
    if (headings.length < 3) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = headings.findIndex((h) => h.el === entry.target);
            if (idx !== -1) setActiveIdx(idx);
          }
        }
      },
      { rootMargin: "-10% 0px -80% 0px" },
    );
    for (const h of headings) observer.observe(h.el);
    return () => observer.disconnect();
  }, [headings]);

  if (!visible) return null;

  const minLevel = headings.reduce((min, h) => Math.min(min, h.level), 6);

  return (
    <div style={{
      position: "fixed",
      right: 16,
      top: "50%",
      transform: "translateY(-50%)",
      maxHeight: "60vh",
      overflow: "auto",
      background: "rgba(var(--bg-primary-rgb, 30,30,30), 0.85)",
      backdropFilter: "blur(8px)",
      border: "1px solid var(--border-color)",
      borderRadius: 6,
      padding: "8px 0",
      zIndex: 50,
      maxWidth: 180,
      scrollbarWidth: "none",
    }}>
      {headings.map((h, i) => (
        <div
          key={i}
          onClick={() => {
            h.el.scrollIntoView({ behavior: "smooth", block: "start" });
            h.el.classList.remove("heading-flash");
            void (h.el as HTMLElement).offsetWidth;
            h.el.classList.add("heading-flash");
          }}
          style={{
            padding: `2px 12px 2px ${8 + (h.level - minLevel) * 8}px`,
            fontSize: 11,
            color: i === activeIdx ? "var(--accent-color)" : "var(--text-faint)",
            cursor: "pointer",
            fontWeight: i === activeIdx ? 600 : 400,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            borderLeft: i === activeIdx ? "2px solid var(--accent-color)" : "2px solid transparent",
            transition: "color 0.15s",
          }}
          title={h.text}
        >
          {h.text}
        </div>
      ))}
    </div>
  );
}
