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
  onSwitchToEditor?: (line: number) => void;
  backlinkCounts?: Record<string, number>;
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

export function Reader({ content, filePath, onNavigate, onSave, onTagClick, searchHighlight, scrollToLine, onScrollToLineDone, scrollToHeading, onScrollToHeadingDone, onSwitchToEditor, backlinkCounts }: ReaderProps) {
  const md = useMemo(() => createMarkdownRenderer(), []);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse cssclasses and headingNumbers from frontmatter
  const { cssClasses, fmHeadingNumbers } = useMemo(() => {
    const fmMatch = content.match(/^---[\t ]*\r?\n([\s\S]*?)\n---/);
    if (!fmMatch) return { cssClasses: "", fmHeadingNumbers: undefined as boolean | undefined };
    const classMatch = fmMatch[1].match(/cssclasses?:\s*(.+)/i);
    const hnMatch = fmMatch[1].match(/headingNumbers:\s*(true|false)/i);
    return {
      cssClasses: classMatch ? classMatch[1].split(/[,\s]+/).filter(Boolean).join(" ") : "",
      fmHeadingNumbers: hnMatch ? hnMatch[1].toLowerCase() === "true" : undefined,
    };
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
  const [propsCollapsed, setPropsCollapsed] = useState(true);

  // Parse references from YAML for citation support
  const references = useMemo(() => {
    const refs = new Map<string, string>();
    const refProp = properties.find((p) => p.key === "references" || p.key === "bibliography");
    if (!refProp) return refs;
    // Parse "key: description" entries from comma-separated or multi-line values
    for (const entry of refProp.value.split(",").map((s) => s.trim()).filter(Boolean)) {
      const colonIdx = entry.indexOf(":");
      if (colonIdx > 0) {
        refs.set(entry.slice(0, colonIdx).trim(), entry.slice(colonIdx + 1).trim());
      } else {
        refs.set(entry, entry);
      }
    }
    return refs;
  }, [properties]);

  const html = useMemo(() => {
    let rendered = md.render(body);
    // Replace [@key] citations with numbered superscripts
    if (references.size > 0) {
      const usedRefs: string[] = [];
      rendered = rendered.replace(/\[@([\w-]+)\]/g, (_, key: string) => {
        let idx = usedRefs.indexOf(key);
        if (idx === -1) { usedRefs.push(key); idx = usedRefs.length - 1; }
        const title = references.get(key) ?? key;
        return `<sup class="citation-ref" title="${title.replace(/"/g, "&quot;")}" style="color: var(--accent-color); cursor: help; font-size: 0.75em;">[${idx + 1}]</sup>`;
      });
      // Append bibliography section
      if (usedRefs.length > 0) {
        rendered += `<hr style="margin: 24px 0 12px; border-color: var(--border-color); opacity: 0.3;"><div class="bibliography" style="font-size: 0.85em; color: var(--text-secondary);"><h4 style="margin: 0 0 8px; font-size: 13px; color: var(--text-faint); text-transform: uppercase; letter-spacing: 0.05em;">References</h4><ol style="margin: 0; padding-left: 20px;">`;
        for (const key of usedRefs) {
          const desc = references.get(key) ?? key;
          rendered += `<li id="ref-${key}" style="margin-bottom: 4px;">${desc}</li>`;
        }
        rendered += `</ol></div>`;
      }
    }
    // Replace [toc] or [[_TOC_]] with auto-generated table of contents
    const tocPattern = /<p>\s*(?:\[toc\]|\[\[_TOC_\]\])\s*<\/p>/gi;
    if (tocPattern.test(rendered)) {
      const headings: Array<{ level: number; text: string; slug: string }> = [];
      const headingRegex = /^(#{1,6})\s+(.+)/gm;
      let match;
      const slugCounts: Record<string, number> = {};
      while ((match = headingRegex.exec(body)) !== null) {
        const level = match[1].length;
        const text = match[2].replace(/\*\*|__|[*_`]/g, "").trim();
        let slug = text.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/^-+|-+$/g, "");
        if (slugCounts[slug]) { slug += `-${slugCounts[slug]}`; }
        slugCounts[slug] = (slugCounts[slug] ?? 0) + 1;
        headings.push({ level, text, slug });
      }
      if (headings.length > 0) {
        const minLevel = Math.min(...headings.map((h) => h.level));
        const tocHtml = `<nav class="inline-toc" style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 6px; padding: 12px 16px; margin: 12px 0;">
          <div class="inline-toc-header" style="display: flex; align-items: center; gap: 6px; cursor: pointer; user-select: none; font-size: 11px; color: var(--text-faint); text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">
            <span class="inline-toc-chevron" style="display: inline-flex; transition: transform 0.2s;">▾</span>
            Table of Contents
            <span style="font-weight: 400; opacity: 0.7;">(${headings.length})</span>
          </div>
          <div class="inline-toc-body" style="margin-top: 6px; overflow: hidden; transition: max-height 0.25s ease, opacity 0.2s ease;">
            ${headings.map((h) => `<div style="padding: 2px 0 2px ${(h.level - minLevel) * 16}px; font-size: 13px;"><a href="#${h.slug}" style="color: var(--accent-color); text-decoration: none;">${h.text}</a></div>`).join("")}
          </div>
        </nav>`;
        rendered = rendered.replace(tocPattern, tocHtml);
      }
    }
    return rendered;
  }, [md, body, references]);

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

      // Wire up collapsible inline TOC
      containerRef.current.querySelectorAll<HTMLElement>(".inline-toc-header").forEach((header) => {
        header.addEventListener("click", () => {
          const body = header.nextElementSibling as HTMLElement;
          const chevron = header.querySelector(".inline-toc-chevron") as HTMLElement;
          if (!body) return;
          const collapsed = body.style.display === "none";
          body.style.display = collapsed ? "" : "none";
          if (chevron) chevron.style.transform = collapsed ? "" : "rotate(-90deg)";
        });
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
          const slug = headingText.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/^-+|-+$/g, "");
          const link = e.shiftKey
            ? `${location.origin}${location.pathname}#/note/${encodeURIComponent(filePath)}#${slug}`
            : `[[${noteName}#${headingText}]]`;
          navigator.clipboard.writeText(link);
          anchor.textContent = "✓";
          anchor.style.color = "var(--accent-color)";
          anchor.title = e.shiftKey ? "URL copied!" : "Wikilink copied!";
          setTimeout(() => { anchor.textContent = "#"; anchor.style.color = "var(--text-faint)"; anchor.title = `Copy link to ${headingText} (Shift+click for URL)`; }, 1500);
        });
        anchor.title = `Copy link to ${headingText} (Shift+click for URL)`;

        // Right-click context menu on headings
        heading.addEventListener("contextmenu", (e) => {
          // Only if right-clicking on the heading text itself (not a link inside it)
          const target = e.target as HTMLElement;
          if (target.tagName === "A" && !target.classList.contains("heading-anchor")) return;
          e.preventDefault();
          e.stopPropagation();

          // Remove any existing heading context menu
          document.querySelectorAll(".heading-ctx-menu").forEach((el) => el.remove());

          const slug = headingText.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/^-+|-+$/g, "");
          const wikilink = `[[${noteName}#${headingText}]]`;
          const url = `${location.origin}${location.pathname}#/note/${encodeURIComponent(filePath)}#${slug}`;

          const menu = document.createElement("div");
          menu.className = "heading-ctx-menu";
          menu.style.cssText = `position: fixed; left: ${e.clientX}px; top: ${e.clientY}px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 6px; padding: 4px 0; z-index: 9999; min-width: 180px; box-shadow: 0 4px 16px rgba(0,0,0,0.3); font-size: 12px;`;

          const items = [
            { label: "Copy heading link", value: wikilink },
            { label: "Copy heading URL", value: url },
            { label: "Copy heading text", value: headingText },
          ];

          for (const item of items) {
            const row = document.createElement("div");
            row.textContent = item.label;
            row.style.cssText = "padding: 6px 12px; cursor: pointer; color: var(--text-normal); transition: background 0.1s;";
            row.addEventListener("mouseenter", () => { row.style.background = "var(--bg-tertiary)"; });
            row.addEventListener("mouseleave", () => { row.style.background = ""; });
            row.addEventListener("click", () => {
              navigator.clipboard.writeText(item.value);
              menu.remove();
            });
            menu.appendChild(row);
          }

          document.body.appendChild(menu);
          const dismiss = () => { menu.remove(); document.removeEventListener("click", dismiss); document.removeEventListener("contextmenu", dismiss); };
          setTimeout(() => {
            document.addEventListener("click", dismiss);
            document.addEventListener("contextmenu", dismiss);
          }, 0);
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

      // Per-heading reading time badge
      const allHeadings = Array.from(containerRef.current.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6"));
      allHeadings.forEach((heading, idx) => {
        // Count words between this heading and the next
        let wordCount = 0;
        let sibling = heading.nextElementSibling as HTMLElement | null;
        while (sibling) {
          if (/^H[1-6]$/.test(sibling.tagName)) break;
          wordCount += (sibling.textContent || "").trim().split(/\s+/).filter(Boolean).length;
          sibling = sibling.nextElementSibling as HTMLElement | null;
        }
        if (wordCount < 20) return; // Skip very short sections
        const mins = Math.max(1, Math.ceil(wordCount / 200));
        const badge = document.createElement("span");
        badge.textContent = `${mins}m`;
        badge.style.cssText = "font-size: 9px; color: var(--text-faint); font-weight: 400; margin-left: 8px; opacity: 0.6; vertical-align: middle;";
        heading.appendChild(badge);
      });

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

        // Collapsible long code blocks (>15 lines)
        if (code) {
          const lineCount = (code.textContent ?? "").split("\n").length;
          if (lineCount > 15) {
            pre.style.maxHeight = "240px";
            pre.style.overflow = "hidden";
            pre.style.transition = "max-height 0.3s ease";
            const expandBtn = document.createElement("button");
            expandBtn.textContent = `Show all ${lineCount} lines`;
            expandBtn.style.cssText = "position: absolute; bottom: 0; left: 0; right: 0; padding: 6px; font-size: 11px; background: linear-gradient(transparent, var(--bg-secondary) 40%); color: var(--accent-color); border: none; cursor: pointer; text-align: center; height: 40px; display: flex; align-items: flex-end; justify-content: center;";
            let expanded = false;
            expandBtn.addEventListener("click", (e) => {
              e.stopPropagation();
              expanded = !expanded;
              if (expanded) {
                pre.style.maxHeight = "none";
                expandBtn.textContent = "Show less";
                expandBtn.style.background = "var(--bg-secondary)";
                expandBtn.style.position = "relative";
                expandBtn.style.height = "auto";
                expandBtn.style.padding = "4px";
              } else {
                pre.style.maxHeight = "240px";
                expandBtn.textContent = `Show all ${lineCount} lines`;
                expandBtn.style.cssText = "position: absolute; bottom: 0; left: 0; right: 0; padding: 6px; font-size: 11px; background: linear-gradient(transparent, var(--bg-secondary) 40%); color: var(--accent-color); border: none; cursor: pointer; text-align: center; height: 40px; display: flex; align-items: flex-end; justify-content: center;";
              }
            });
            pre.appendChild(expandBtn);
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

  // Image captions: title or alt attribute → <figcaption> below image
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const imgs = container.querySelectorAll<HTMLImageElement>("img");
    imgs.forEach((img) => {
      const title = img.getAttribute("title") || img.getAttribute("alt");
      if (!title || title === img.getAttribute("src")) return;
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

  // External link favicons
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const links = container.querySelectorAll<HTMLAnchorElement>('a[target="_blank"]');
    links.forEach((a) => {
      if (a.querySelector(".ext-favicon")) return;
      try {
        const url = new URL(a.href);
        const img = document.createElement("img");
        img.className = "ext-favicon";
        img.src = `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=16`;
        img.width = 14;
        img.height = 14;
        img.style.cssText = "vertical-align: -2px; margin-right: 3px; border-radius: 2px; opacity: 0.8;";
        img.onerror = () => img.remove();
        a.insertBefore(img, a.firstChild);
      } catch {}
    });
  }, [html]);

  // External link hover preview: show page title on hover
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const titleCache = new Map<string, string>();
    const links = container.querySelectorAll<HTMLAnchorElement>('a[target="_blank"]');
    links.forEach((a) => {
      let tooltip: HTMLDivElement | null = null;
      let timer: ReturnType<typeof setTimeout> | null = null;
      a.addEventListener("mouseenter", () => {
        timer = setTimeout(() => {
          const href = a.href;
          const show = (title: string) => {
            if (tooltip) return;
            tooltip = document.createElement("div");
            tooltip.style.cssText = "position:absolute;z-index:1000;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;padding:6px 10px;font-size:12px;color:var(--text-primary);box-shadow:0 4px 12px rgba(0,0,0,0.3);max-width:300px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none;";
            tooltip.textContent = title;
            const rect = a.getBoundingClientRect();
            const cRect = container.getBoundingClientRect();
            tooltip.style.left = `${rect.left - cRect.left}px`;
            tooltip.style.top = `${rect.bottom - cRect.top + 4}px`;
            container.style.position = "relative";
            container.appendChild(tooltip);
          };
          if (titleCache.has(href)) {
            const cached = titleCache.get(href)!;
            if (cached) show(cached);
          } else {
            fetch(`/api/vault/fetch-title?url=${encodeURIComponent(href)}`, { credentials: "include" })
              .then((r) => r.json())
              .then((data) => {
                titleCache.set(href, data.title || "");
                if (data.title) show(data.title);
              })
              .catch(() => titleCache.set(href, ""));
          }
        }, 400);
      });
      a.addEventListener("mouseleave", () => {
        if (timer) { clearTimeout(timer); timer = null; }
        if (tooltip) { tooltip.remove(); tooltip = null; }
      });
    });
  }, [html]);

  // Link cards: bare URLs on their own line become rich cards
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    const paragraphs = container.querySelectorAll<HTMLParagraphElement>("p");
    paragraphs.forEach((p) => {
      const links = p.querySelectorAll("a");
      // Only transform paragraphs that contain exactly one link and no other text
      if (links.length !== 1) return;
      const a = links[0];
      if (!a.href || !/^https?:\/\//.test(a.href)) return;
      const text = p.textContent?.trim() ?? "";
      const linkText = a.textContent?.trim() ?? "";
      if (text !== linkText) return; // Has other content besides the link
      // Create card
      const card = document.createElement("a");
      card.href = a.href;
      card.target = "_blank";
      card.rel = "noopener noreferrer";
      card.style.cssText = "display: flex; align-items: center; gap: 10px; padding: 10px 14px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-secondary); text-decoration: none; color: inherit; margin: 4px 0; transition: border-color 0.15s;";
      card.onmouseenter = () => { card.style.borderColor = "var(--accent-color)"; };
      card.onmouseleave = () => { card.style.borderColor = "var(--border-color)"; };
      try {
        const url = new URL(a.href);
        card.innerHTML = `<img src="https://www.google.com/s2/favicons?domain=${url.hostname}&sz=32" width="24" height="24" style="border-radius:4px;flex-shrink:0;" onerror="this.style.display='none'" /><div style="flex:1;overflow:hidden;"><div class="link-card-title" style="font-size:13px;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${url.hostname}</div><div style="font-size:11px;color:var(--text-faint);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${a.href.length > 80 ? a.href.slice(0, 80) + "…" : a.href}</div></div>`;
        p.replaceWith(card);
        // Fetch title, description, image asynchronously
        fetch(`/api/vault/fetch-title?url=${encodeURIComponent(a.href)}`, { credentials: "include" })
          .then((r) => r.json())
          .then((data) => {
            if (cancelled) return;
            if (data.title) {
              const titleEl = card.querySelector(".link-card-title");
              if (titleEl) titleEl.textContent = data.title;
            }
            if (data.description) {
              const descEl = document.createElement("div");
              descEl.style.cssText = "font-size:11px;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px;";
              const desc = data.description.length > 120 ? data.description.slice(0, 120) + "…" : data.description;
              descEl.textContent = desc;
              const infoDiv = card.querySelector(".link-card-title")?.parentElement;
              if (infoDiv) infoDiv.appendChild(descEl);
            }
            if (data.image) {
              const img = document.createElement("img");
              img.src = data.image;
              img.style.cssText = "width:60px;height:40px;object-fit:cover;border-radius:4px;flex-shrink:0;";
              img.onerror = () => img.remove();
              card.appendChild(img);
            }
          })
          .catch(() => {});
      } catch {}
    });
    return () => { cancelled = true; };
  }, [html]);

  // Per-section checklist progress bar
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const headings = container.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6");
    headings.forEach((heading) => {
      // Count checkboxes between this heading and the next heading of same/higher level
      let total = 0;
      let checked = 0;
      let sibling = heading.nextElementSibling;
      const level = parseInt(heading.tagName[1], 10);
      while (sibling) {
        const sibTag = sibling.tagName;
        if (/^H[1-6]$/.test(sibTag) && parseInt(sibTag[1], 10) <= level) break;
        const cbs = sibling.querySelectorAll<HTMLInputElement>("input[type=checkbox]");
        cbs.forEach((cb) => { total++; if (cb.checked) checked++; });
        sibling = sibling.nextElementSibling;
      }
      if (total < 2) return; // Only show for 2+ tasks
      const pct = Math.round((checked / total) * 100);
      const bar = document.createElement("span");
      bar.style.cssText = `display:inline-flex;align-items:center;gap:4px;margin-left:8px;font-size:10px;color:var(--text-faint);vertical-align:middle;`;
      bar.innerHTML = `<span style="display:inline-block;width:40px;height:3px;background:var(--border-color);border-radius:2px;overflow:hidden;"><span style="display:block;width:${pct}%;height:100%;background:${pct === 100 ? "#4caf50" : "var(--accent-color)"};border-radius:2px;"></span></span><span>${checked}/${total}</span>`;
      heading.appendChild(bar);
    });
  }, [html]);

  // Task due date highlighting — 📅 YYYY-MM-DD or ⏳ YYYY-MM-DD
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const items = container.querySelectorAll<HTMLElement>("li.task-list-item");
    items.forEach((li) => {
      const text = li.textContent || "";
      const dateMatch = text.match(/[📅⏳🗓️]\s*(\d{4}-\d{2}-\d{2})/);
      if (!dateMatch) return;
      const dueDate = new Date(dateMatch[1] + "T00:00:00");
      if (isNaN(dueDate.getTime())) return;
      const isChecked = li.querySelector<HTMLInputElement>("input[type=checkbox]")?.checked;
      if (isChecked) return; // Don't highlight completed tasks
      const diffDays = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      // Find the date text node and wrap it
      const walker = document.createTreeWalker(li, NodeFilter.SHOW_TEXT);
      let node: Text | null;
      while ((node = walker.nextNode() as Text | null)) {
        const idx = node.textContent?.indexOf(dateMatch[1]) ?? -1;
        if (idx === -1) continue;
        const span = document.createElement("span");
        span.textContent = dateMatch[1];
        if (diffDays < 0) {
          span.style.cssText = "color: #ff6b6b; font-weight: 600; background: rgba(255,107,107,0.1); padding: 0 3px; border-radius: 3px;";
          span.title = `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? "s" : ""}`;
        } else if (diffDays === 0) {
          span.style.cssText = "color: #ffa726; font-weight: 600; background: rgba(255,167,38,0.1); padding: 0 3px; border-radius: 3px;";
          span.title = "Due today";
        } else if (diffDays <= 3) {
          span.style.cssText = "color: #ffeb3b; font-weight: 600; background: rgba(255,235,59,0.08); padding: 0 3px; border-radius: 3px;";
          span.title = `Due in ${diffDays} day${diffDays !== 1 ? "s" : ""}`;
        }
        if (span.style.cssText) {
          const after = node.splitText(idx);
          after.textContent = after.textContent?.slice(dateMatch[1].length) ?? "";
          node.parentNode?.insertBefore(span, after);
        }
        break;
      }
    });
  }, [html]);

  // Style blockquote citations — detect "— Author" or "-- Author" at end, linkify URLs
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

      // Linkify URLs in citation text
      const citText = citMatch[1];
      const urlMatch = citText.match(/(https?:\/\/[^\s)>]+)/);
      if (urlMatch && !lastP.querySelector("a")) {
        const url = urlMatch[1];
        lastP.innerHTML = lastP.innerHTML.replace(
          url,
          `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: var(--accent-color); text-decoration: underline; text-decoration-style: dotted; text-underline-offset: 3px;">${url.replace(/^https?:\/\//, "").split("/")[0]}</a>`
        );
      }

      // Detect "Source: URL" pattern in any paragraph
      for (let i = 0; i < paragraphs.length; i++) {
        const pText = paragraphs[i].textContent || "";
        const srcMatch = pText.match(/^Source:\s*(https?:\/\/[^\s)>]+)/i);
        if (srcMatch && !paragraphs[i].querySelector("a.source-link")) {
          const srcUrl = srcMatch[1];
          const domain = srcUrl.replace(/^https?:\/\//, "").split("/")[0];
          paragraphs[i].innerHTML = paragraphs[i].innerHTML.replace(
            /Source:\s*(https?:\/\/[^\s)>]+)/i,
            `<span style="color: var(--text-faint); font-size: 0.85em;">Source: <a class="source-link" href="${srcUrl}" target="_blank" rel="noopener noreferrer" style="color: var(--accent-color); text-decoration: underline dotted; text-underline-offset: 3px;">${domain}</a></span>`
          );
          paragraphs[i].style.marginTop = "4px";
        }
      }
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

  // Backlink count badges on wikilinks
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !backlinkCounts) return;
    const links = container.querySelectorAll<HTMLAnchorElement>("a.wikilink[data-target]");
    const badges: HTMLElement[] = [];
    links.forEach((link) => {
      const target = link.dataset.target!;
      // Match target to backlinkCounts keys (basename match)
      const basename = target.split("/").pop()?.replace(/\.md$/i, "").toLowerCase() ?? "";
      let count = 0;
      for (const [path, c] of Object.entries(backlinkCounts)) {
        const key = path.split("/").pop()?.replace(/\.md$/i, "").toLowerCase() ?? "";
        if (key === basename) { count = c; break; }
      }
      if (count < 2) return;
      // Don't duplicate
      if (link.nextElementSibling?.classList.contains("wikilink-refcount")) return;
      const badge = document.createElement("span");
      badge.className = "wikilink-refcount";
      badge.textContent = String(count);
      badge.title = `${count} backlinks`;
      badge.style.cssText = "display: inline-block; font-size: 9px; color: var(--text-faint); background: var(--bg-tertiary); padding: 0 3px; border-radius: 6px; margin-left: 2px; vertical-align: middle; line-height: 14px; min-width: 14px; text-align: center;";
      link.after(badge);
      badges.push(badge);
    });
    return () => badges.forEach((b) => b.remove());
  }, [html, backlinkCounts]);

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

  // Hydrate note embeds after html is set (with depth limit + cycle detection)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    const MAX_EMBED_DEPTH = 3;

    function hydrateEmbeds(parent: HTMLElement, depth: number, ancestors: Set<string>) {
      const embeds = parent.querySelectorAll<HTMLElement>(".embed-note[data-target]");
      if (embeds.length === 0) return;

      for (const embedEl of embeds) {
        // Skip already-hydrated embeds
        if (embedEl.dataset.hydrated === "true") continue;
        embedEl.dataset.hydrated = "true";

        const target = embedEl.dataset.target;
        if (!target) continue;

        // Depth limit
        if (depth >= MAX_EMBED_DEPTH) {
          embedEl.innerHTML = `<span style="color: var(--text-faint); font-size: 11px; font-style: italic;">Embed depth limit reached: ${target}</span>`;
          embedEl.style.borderLeft = "2px solid var(--border-color)";
          embedEl.style.paddingLeft = "12px";
          embedEl.style.margin = "8px 0";
          continue;
        }

        const from = filePath;
        fetch(`/api/vault/resolve?target=${encodeURIComponent(target)}&from=${encodeURIComponent(from)}`, { credentials: "include" })
          .then((r) => r.json())
          .then((data) => {
            if (cancelled || !data.resolved) return;

            // Cycle detection
            if (ancestors.has(data.resolved)) {
              embedEl.innerHTML = `<span style="color: #f88; font-size: 11px;">Circular embed detected: ${target}</span>`;
              embedEl.style.borderLeft = "2px solid #f88";
              embedEl.style.paddingLeft = "12px";
              embedEl.style.margin = "8px 0";
              return;
            }

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

                // Recursively hydrate nested embeds
                const nextAncestors = new Set(ancestors);
                nextAncestors.add(data.resolved);
                hydrateEmbeds(embedEl, depth + 1, nextAncestors);
              });
          })
          .catch(() => {
            if (!cancelled) {
              embedEl.innerHTML = `<span style="color: #f88; font-size: 12px;">Failed to load: ${target}</span>`;
            }
          });
      }
    }

    hydrateEmbeds(container, 0, new Set([filePath]));

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
            el.style.cursor = "pointer";
            el.title = "Click to expand";
            el.addEventListener("click", () => {
              const overlay = document.createElement("div");
              overlay.style.cssText = "position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;cursor:zoom-out;";
              const svgClone = el.querySelector("svg")?.cloneNode(true) as SVGElement;
              if (svgClone) {
                svgClone.style.maxWidth = "90vw";
                svgClone.style.maxHeight = "90vh";
                svgClone.style.width = "auto";
                svgClone.style.height = "auto";
                overlay.appendChild(svgClone);
              }
              overlay.addEventListener("click", () => overlay.remove());
              document.addEventListener("keydown", function esc(e) {
                if (e.key === "Escape") { overlay.remove(); document.removeEventListener("keydown", esc); }
              });
              document.body.appendChild(overlay);
            });
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

  // Hydrate dataview-style query blocks
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const codeBlocks = container.querySelectorAll<HTMLElement>("code.language-dataview, code.hljs.language-dataview");
    if (codeBlocks.length === 0) return;

    let cancelled = false;

    for (const code of codeBlocks) {
      const pre = code.closest("pre");
      if (!pre) continue;
      const query = (code.textContent ?? "").trim();
      if (!query) continue;

      // Parse the query
      const lines = query.split("\n").map((l) => l.trim()).filter(Boolean);
      const typeLine = lines[0]?.toUpperCase() ?? "";
      const isTable = typeLine.startsWith("TABLE");
      const isList = typeLine.startsWith("LIST");
      if (!isTable && !isList) continue;

      // Parse TABLE fields
      const tableFields = isTable
        ? typeLine.replace(/^TABLE\s*/i, "").split(",").map((f) => f.trim()).filter(Boolean)
        : [];

      // Parse FROM / WHERE / SORT / LIMIT
      let fromClause = "";
      let sortField = "name";
      let sortDir: "asc" | "desc" = "asc";
      let limit = 50;

      for (const line of lines.slice(1)) {
        const upper = line.toUpperCase();
        if (upper.startsWith("FROM")) {
          fromClause = line.slice(4).trim();
        } else if (upper.startsWith("SORT")) {
          const parts = line.slice(4).trim().split(/\s+/);
          sortField = parts[0] ?? "name";
          if (parts[1]?.toUpperCase() === "DESC") sortDir = "desc";
        } else if (upper.startsWith("LIMIT")) {
          limit = parseInt(line.slice(5).trim(), 10) || 50;
        }
      }

      // Build search query from FROM clause
      let searchQ = "";
      if (fromClause.startsWith("#")) {
        searchQ = fromClause; // tag search
      } else if (fromClause.startsWith('"') && fromClause.endsWith('"')) {
        searchQ = `path:${fromClause.slice(1, -1)}`; // folder search
      } else if (fromClause) {
        searchQ = fromClause;
      }

      // Replace code block with loading indicator
      const resultDiv = document.createElement("div");
      resultDiv.style.cssText = "padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-secondary); margin: 8px 0; font-size: 13px;";
      resultDiv.innerHTML = '<span style="color: var(--text-faint); font-size: 11px;">Running query...</span>';
      pre.replaceWith(resultDiv);

      // Fetch results
      const url = searchQ
        ? `/api/vault/search?q=${encodeURIComponent(searchQ)}`
        : "/api/vault/tree";

      fetch(url, { credentials: "include" })
        .then((r) => r.json())
        .then((data) => {
          if (cancelled) return;

          let files: Array<{ path: string; name: string }> = [];

          if (data.results) {
            // Search results
            files = (data.results as Array<{ path: string }>).map((r) => ({
              path: r.path,
              name: r.path.replace(/\.md$/, "").split("/").pop() ?? r.path,
            }));
          } else if (data.tree) {
            // Tree results — flatten
            const flatten = (entries: Array<{ type: string; path: string; children?: unknown[] }>): Array<{ path: string; name: string }> => {
              const out: Array<{ path: string; name: string }> = [];
              for (const e of entries) {
                if (e.type === "file" && e.path.endsWith(".md")) {
                  // Filter by folder if needed
                  const folder = fromClause.replace(/^"|"$/g, "");
                  if (folder && !e.path.startsWith(folder)) continue;
                  out.push({ path: e.path, name: e.path.replace(/\.md$/, "").split("/").pop() ?? e.path });
                }
                if (e.children) out.push(...flatten(e.children as Array<{ type: string; path: string; children?: unknown[] }>));
              }
              return out;
            };
            files = flatten(data.tree);
          }

          // Sort
          if (sortField === "name" || sortField === "file.name") {
            files.sort((a, b) => sortDir === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));
          }

          // Limit
          files = files.slice(0, limit);

          if (files.length === 0) {
            resultDiv.innerHTML = '<span style="color: var(--text-faint); font-style: italic;">No results</span>';
            return;
          }

          if (isList) {
            resultDiv.innerHTML = `<div style="color: var(--text-faint); font-size: 10px; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">LIST (${files.length})</div>` +
              files.map((f) =>
                `<div style="padding: 2px 0;"><a class="wikilink" data-target="${f.path.replace(/"/g, "&quot;")}" href="#" style="color: var(--accent-color); text-decoration: none;">${f.name}</a></div>`
              ).join("");
          } else {
            // TABLE
            const headers = ["Name", ...tableFields];
            resultDiv.innerHTML = `<div style="color: var(--text-faint); font-size: 10px; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">TABLE (${files.length})</div>` +
              `<table style="width: 100%; border-collapse: collapse; font-size: 12px;">` +
              `<thead><tr>${headers.map((h) => `<th style="text-align: left; padding: 4px 8px; border-bottom: 1px solid var(--border-color); color: var(--text-muted);">${h}</th>`).join("")}</tr></thead>` +
              `<tbody>${files.map((f) => {
                const cells = [`<a class="wikilink" data-target="${f.path.replace(/"/g, "&quot;")}" href="#" style="color: var(--accent-color); text-decoration: none;">${f.name}</a>`];
                for (const field of tableFields) {
                  cells.push(`<span style="color: var(--text-secondary);">-</span>`);
                }
                return `<tr>${cells.map((c) => `<td style="padding: 4px 8px; border-bottom: 1px solid var(--border-color);">${c}</td>`).join("")}</tr>`;
              }).join("")}</tbody></table>`;
          }
        })
        .catch(() => {
          if (!cancelled) {
            resultDiv.innerHTML = '<span style="color: #f88; font-size: 12px;">Query failed</span>';
          }
        });
    }

    return () => { cancelled = true; };
  }, [html, filePath]);

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

                // Extract outgoing wikilinks from the full content
                const outgoingLinks: string[] = [];
                const wikiRe = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
                let wm;
                while ((wm = wikiRe.exec(fileData.content)) !== null) {
                  const linkName = wm[1].split("#")[0].trim();
                  if (linkName && !outgoingLinks.includes(linkName)) outgoingLinks.push(linkName);
                  if (outgoingLinks.length >= 10) break;
                }

                let outgoingHtml = "";
                if (outgoingLinks.length > 0) {
                  outgoingHtml = `<div style="border-top: 1px solid var(--border-color); margin-top: 8px; padding-top: 6px;">
                    <div style="font-size: 10px; color: var(--text-faint); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 4px;">Outgoing links</div>
                    ${outgoingLinks.map(l => `<div style="font-size: 12px; padding: 1px 0; color: var(--accent-color);">→ ${l.split("/").pop()}</div>`).join("")}
                    ${outgoingLinks.length >= 10 ? '<div style="font-size: 11px; color: var(--text-faint);">…and more</div>' : ""}
                  </div>`;
                }

                previewEl.innerHTML = md.render(previewContent) + outgoingHtml;

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
                html += `<div class="tag-popover-link" data-path="${(r.path as string).replace(/"/g, "&quot;")}" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;padding:1px 0;" onmouseenter="this.style.color='var(--accent-color)'" onmouseleave="this.style.color='var(--text-secondary)'">${name}</div>`;
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

  // Reader selection floating toolbar
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let toolbar: HTMLDivElement | null = null;

    const removeToolbar = () => {
      if (toolbar) { toolbar.remove(); toolbar = null; }
    };

    const handleSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) { removeToolbar(); return; }
      const range = sel.getRangeAt(0);
      if (!container.contains(range.commonAncestorContainer)) { removeToolbar(); return; }
      const text = sel.toString().trim();
      if (text.length < 2) { removeToolbar(); return; }

      removeToolbar();
      toolbar = document.createElement("div");
      toolbar.style.cssText = "position:fixed;z-index:1000;display:flex;gap:2px;padding:4px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,0.3);font-size:11px;";
      const rect = range.getBoundingClientRect();
      toolbar.style.left = `${rect.left + rect.width / 2 - 60}px`;
      toolbar.style.top = `${rect.top - 36}px`;

      const btnStyle = "padding:3px 8px;border:none;background:none;color:var(--text-secondary);cursor:pointer;border-radius:3px;white-space:nowrap;";
      const hoverIn = (e: Event) => (e.target as HTMLElement).style.background = "var(--bg-tertiary)";
      const hoverOut = (e: Event) => (e.target as HTMLElement).style.background = "none";

      const copyBtn = document.createElement("button");
      copyBtn.textContent = "Copy";
      copyBtn.style.cssText = btnStyle;
      copyBtn.addEventListener("mouseenter", hoverIn);
      copyBtn.addEventListener("mouseleave", hoverOut);
      copyBtn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        navigator.clipboard.writeText(text);
        copyBtn.textContent = "Copied!";
        setTimeout(removeToolbar, 600);
      });
      toolbar.appendChild(copyBtn);

      if (onTagClick) {
        const searchBtn = document.createElement("button");
        searchBtn.textContent = "Search";
        searchBtn.style.cssText = btnStyle;
        searchBtn.addEventListener("mouseenter", hoverIn);
        searchBtn.addEventListener("mouseleave", hoverOut);
        searchBtn.addEventListener("mousedown", (e) => {
          e.preventDefault();
          // Dispatch a custom event that App can listen to
          container.dispatchEvent(new CustomEvent("reader-search", { detail: text, bubbles: true }));
          removeToolbar();
        });
        toolbar.appendChild(searchBtn);
      }

      document.body.appendChild(toolbar);
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
      removeToolbar();
    };
  }, [html, onTagClick]);

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

    // Handle tag popover link clicks
    const tagPopoverLink = (e.target as HTMLElement).closest<HTMLElement>(".tag-popover-link[data-path]");
    if (tagPopoverLink && tagPopoverLink.dataset.path) {
      onNavigate(tagPopoverLink.dataset.path);
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

    // Handle footnote ref clicks — show popover instead of scrolling
    const fnLink = (e.target as HTMLElement).closest<HTMLAnchorElement>("sup.footnote-ref a");
    if (fnLink) {
      e.preventDefault();
      e.stopPropagation();
      const href = fnLink.getAttribute("href"); // e.g. "#fn1"
      if (href && containerRef.current) {
        const fnEl = containerRef.current.querySelector<HTMLElement>(href);
        if (fnEl) {
          // Remove any existing popover
          document.querySelectorAll(".fn-popover").forEach((el) => el.remove());
          const popover = document.createElement("div");
          popover.className = "fn-popover";
          popover.style.cssText = "position:absolute;z-index:1000;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;padding:8px 12px;max-width:350px;font-size:13px;color:var(--text-primary);box-shadow:0 4px 12px rgba(0,0,0,0.3);line-height:1.5;";
          // Clone footnote content minus backref
          const clone = fnEl.cloneNode(true) as HTMLElement;
          clone.querySelectorAll("a.footnote-backref").forEach((a) => a.remove());
          popover.innerHTML = clone.innerHTML;
          // Position near the ref
          const rect = fnLink.getBoundingClientRect();
          const containerRect = containerRef.current.getBoundingClientRect();
          popover.style.left = `${rect.left - containerRect.left}px`;
          popover.style.top = `${rect.bottom - containerRect.top + 4}px`;
          containerRef.current.style.position = "relative";
          containerRef.current.appendChild(popover);
          // Close on click outside
          const close = (ev: MouseEvent) => {
            if (!popover.contains(ev.target as Node)) {
              popover.remove();
              document.removeEventListener("click", close, true);
            }
          };
          setTimeout(() => document.addEventListener("click", close, true), 0);
        }
      }
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
                {/* Computed metadata */}
                {(() => {
                  const text = body.replace(/```[\s\S]*?```/g, "");
                  const words = text.trim().split(/\s+/).filter(Boolean).length;
                  const links = (text.match(/\[\[[^\]]+\]\]/g) ?? []).length;
                  const tags = (text.match(/#[\w/-]+/g) ?? []).length;
                  const headings = (body.match(/^#{1,6}\s+.+$/gm) ?? []).length;
                  const meta = [
                    { key: "words", value: words.toLocaleString() },
                    { key: "links", value: String(links) },
                    { key: "tags", value: String(tags) },
                    { key: "headings", value: String(headings) },
                  ].filter(m => parseInt(m.value.replace(/,/g, "")) > 0);
                  return meta.map((m) => (
                    <tr key={`_${m.key}`} style={{ borderTop: "1px solid var(--border-color)" }}>
                      <td style={{ padding: "4px 12px", color: "var(--text-faint)", width: 100, verticalAlign: "top", fontStyle: "italic" }}>{m.key}</td>
                      <td style={{ padding: "4px 12px", color: "var(--text-muted)" }}>{m.value}</td>
                    </tr>
                  ));
                })()}
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
        className={`reader-view${cssClasses ? ` ${cssClasses}` : ""}${fmHeadingNumbers === true ? " heading-numbers-enabled" : ""}${fmHeadingNumbers === false ? " heading-numbers-disabled" : ""}`}
        onClick={handleClick}
        onDoubleClick={(e) => {
          if (!onSwitchToEditor) return;
          // Don't switch if user is selecting text on a link/checkbox/etc
          const target = e.target as HTMLElement;
          if (target.closest("a, input, button, .embed-note, .fn-popover")) return;
          // Find nearest block element's text to match to source line
          const block = target.closest("p, h1, h2, h3, h4, h5, h6, li, blockquote, td, th, pre") as HTMLElement | null;
          if (!block) return;
          const text = (block.textContent || "").trim();
          if (!text) return;
          // Search source content for this text to find approximate line
          const lines = content.split("\n");
          // Strip markdown to compare
          const needle = text.slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          let bestLine = 1;
          for (let i = 0; i < lines.length; i++) {
            const stripped = lines[i].replace(/[#*_`~\[\]>|]/g, "").trim();
            if (stripped.includes(text.slice(0, 40)) || (needle.length > 5 && new RegExp(needle.slice(0, 40)).test(stripped))) {
              bestLine = i + 1;
              break;
            }
          }
          onSwitchToEditor(bestLine);
        }}
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
