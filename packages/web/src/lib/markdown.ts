import MarkdownIt from "markdown-it";
// @ts-expect-error — no types available
import footnotePlugin from "markdown-it-footnote";
// @ts-expect-error — no types available
import deflistPlugin from "markdown-it-deflist";
// @ts-expect-error — no types available
import abbrPlugin from "markdown-it-abbr";
// @ts-expect-error — no types available
import supPlugin from "markdown-it-sup";
// @ts-expect-error — no types available
import subPlugin from "markdown-it-sub";
import type StateInline from "markdown-it/lib/rules_inline/state_inline.mjs";
import type StateBlock from "markdown-it/lib/rules_block/state_block.mjs";
import katex from "katex";
import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import css from "highlight.js/lib/languages/css";
import json from "highlight.js/lib/languages/json";
import bash from "highlight.js/lib/languages/bash";
import yaml from "highlight.js/lib/languages/yaml";
import markdown from "highlight.js/lib/languages/markdown";
import xml from "highlight.js/lib/languages/xml";
import sql from "highlight.js/lib/languages/sql";
import rust from "highlight.js/lib/languages/rust";
import go from "highlight.js/lib/languages/go";

hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("js", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("ts", typescript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("py", python);
hljs.registerLanguage("css", css);
hljs.registerLanguage("json", json);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("sh", bash);
hljs.registerLanguage("shell", bash);
hljs.registerLanguage("yaml", yaml);
hljs.registerLanguage("yml", yaml);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("md", markdown);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("go", go);

/** Create a markdown-it instance with Obsidian-compatible extensions */
export function createMarkdownRenderer(onLinkClick?: (target: string) => void) {
  const md = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: false,
    highlight: (str, lang) => {
      // Mermaid blocks get special rendering
      if (lang === "mermaid") {
        return `<div class="mermaid-placeholder" data-mermaid="${escapeAttr(str)}">${escapeHtml(str)}</div>`;
      }
      if (lang && hljs.getLanguage(lang)) {
        try {
          return hljs.highlight(str, { language: lang }).value;
        } catch { /* fall through */ }
      }
      return ""; // use default escaping
    },
  });

  // Plugin: footnotes [^1] and [^1]: definition
  md.use(footnotePlugin);
  md.use(deflistPlugin);
  md.use(supPlugin);
  md.use(subPlugin);
  md.use(abbrPlugin);

  // Plugin: heading IDs for deep linking
  md.core.ruler.push("heading_ids", (state) => {
    const slugCounts: Record<string, number> = {};
    for (let i = 0; i < state.tokens.length; i++) {
      const token = state.tokens[i];
      if (token.type !== "heading_open") continue;
      // Get the text content from the next inline token
      const inline = state.tokens[i + 1];
      if (!inline || inline.type !== "inline") continue;
      const text = inline.content.replace(/\s*\^[\w-]+$/, "");
      let slug = text.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/^-+|-+$/g, "");
      if (!slug) slug = "heading";
      const count = slugCounts[slug] || 0;
      slugCounts[slug] = count + 1;
      token.attrSet("id", count > 0 ? `${slug}-${count}` : slug);
    }
  });

  // Plugin: hide block reference markers (^block-id)
  // Plugin: strip %%comments%% (inline and block)
  md.core.ruler.push("strip_comments", (state) => {
    // Remove block-level tokens that are entirely comments
    state.tokens = state.tokens.filter((token) => {
      if (token.type === "paragraph_open" || token.type === "paragraph_close") return true;
      if (token.type === "inline" && token.content) {
        token.content = token.content.replace(/%%[\s\S]*?%%/g, "");
        if (token.children) {
          for (const child of token.children) {
            if (child.type === "text") {
              child.content = child.content.replace(/%%[\s\S]*?%%/g, "");
            }
          }
        }
      }
      return true;
    });
  });

  // Plugin: inline fields (key:: value) — Dataview-style
  md.core.ruler.push("inline_fields", (state) => {
    for (const token of state.tokens) {
      if (token.type !== "inline" || !token.children) continue;
      for (const child of token.children) {
        if (child.type === "text" && child.content.includes("::")) {
          child.content = child.content.replace(
            /\b([\w-]+)::\s*(.+?)(?=$|\n)/g,
            (_m, key, val) => `<span class="inline-field"><span class="inline-field-key">${escapeHtml(key)}</span><span class="inline-field-separator">::</span> <span class="inline-field-value">${escapeHtml(val.trim())}</span></span>`,
          );
          child.type = "html_inline";
        }
      }
    }
  });

  md.core.ruler.push("block_refs", (state) => {
    for (const token of state.tokens) {
      if (token.type !== "inline" || !token.children) continue;
      for (const child of token.children) {
        if (child.type === "text") {
          child.content = child.content.replace(/\s*\^[\w-]+$/gm, "");
        }
      }
    }
  });

  // Plugin: auto-link YYYY-MM-DD dates to daily notes
  md.core.ruler.push("date_links", (state) => {
    const dateRe = /\b(\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01]))\b/g;
    for (const blockToken of state.tokens) {
      if (blockToken.type !== "inline" || !blockToken.children) continue;
      const newChildren: typeof blockToken.children = [];
      for (const child of blockToken.children) {
        if (child.type !== "text") { newChildren.push(child); continue; }
        const text = child.content;
        let lastIdx = 0;
        let match: RegExpExecArray | null;
        dateRe.lastIndex = 0;
        let hasMatch = false;
        while ((match = dateRe.exec(text)) !== null) {
          hasMatch = true;
          if (match.index > lastIdx) {
            const before = new state.Token("text", "", 0);
            before.content = text.slice(lastIdx, match.index);
            newChildren.push(before);
          }
          const openLink = new state.Token("html_inline", "", 0);
          openLink.content = `<a class="date-link" data-date="${match[1]}" title="Open daily note: ${match[1]}">`;
          newChildren.push(openLink);
          const dateText = new state.Token("text", "", 0);
          dateText.content = match[1];
          newChildren.push(dateText);
          const closeLink = new state.Token("html_inline", "", 0);
          closeLink.content = "</a>";
          newChildren.push(closeLink);
          lastIdx = match.index + match[0].length;
        }
        if (!hasMatch) {
          newChildren.push(child);
        } else if (lastIdx < text.length) {
          const after = new state.Token("text", "", 0);
          after.content = text.slice(lastIdx);
          newChildren.push(after);
        }
      }
      blockToken.children = newChildren;
    }
  });

  // Plugin: wikilinks [[target]] and [[target|display]]
  md.inline.ruler.push("wikilink", wikilinkRule);
  md.renderer.rules.wikilink = (tokens, idx) => {
    const token = tokens[idx];
    const target = token.meta.target as string;
    // Display: explicit alias > basename (strip path + heading + .md)
    const display = (token.meta.display as string) || target.split("/").pop()?.replace(/\.md$/, "") || target;
    const href = `#/note/${encodeURIComponent(target)}`;
    return `<a class="wikilink" href="${href}" data-target="${escapeAttr(target)}" title="${escapeAttr(target)}">${escapeHtml(display)}</a>`;
  };

  // Plugin: embeds ![[target]]
  md.inline.ruler.push("embed", embedRule);
  md.renderer.rules.embed = (tokens, idx) => {
    const token = tokens[idx];
    const target = token.meta.target as string;
    const sizeStr = token.meta.size as string | undefined;
    if (/\.(png|jpg|jpeg|gif|svg|webp|bmp)$/i.test(target)) {
      let sizeAttrs = "";
      if (sizeStr) {
        const match = sizeStr.match(/^(\d+)(?:x(\d+))?$/);
        if (match) {
          sizeAttrs += ` width="${match[1]}"`;
          if (match[2]) sizeAttrs += ` height="${match[2]}"`;
        }
      }
      return `<div class="embed embed-image"><img class="embed-img" data-target="${escapeAttr(target)}" alt="${escapeAttr(target)}"${sizeAttrs} /></div>`;
    }
    if (/\.(mp3|wav|ogg|m4a|flac|aac|wma)$/i.test(target)) {
      return `<div class="embed embed-audio" data-target="${escapeAttr(target)}"><audio controls preload="metadata" data-target="${escapeAttr(target)}" style="width: 100%; max-width: 500px;"><source data-target="${escapeAttr(target)}" /></audio><div class="embed-label" style="font-size: 11px; margin-top: 4px;">${escapeHtml(target)}</div></div>`;
    }
    if (/\.(mp4|webm|mov|mkv|avi|ogv)$/i.test(target)) {
      return `<div class="embed embed-video" data-target="${escapeAttr(target)}"><video controls preload="metadata" data-target="${escapeAttr(target)}" style="width: 100%; max-width: 640px; border-radius: 4px;"><source data-target="${escapeAttr(target)}" /></video><div class="embed-label" style="font-size: 11px; margin-top: 4px;">${escapeHtml(target)}</div></div>`;
    }
    if (/\.pdf$/i.test(target)) {
      return `<div class="embed embed-pdf" data-target="${escapeAttr(target)}"><iframe data-target="${escapeAttr(target)}" style="width: 100%; height: 600px; border: 1px solid var(--border-color); border-radius: 4px;" /></div>`;
    }
    // Non-note file embeds: show file type badge with download link
    const extMatch = target.match(/\.(\w+)$/i);
    if (extMatch && !/\.md$/i.test(target)) {
      const ext = extMatch[1].toUpperCase();
      return `<div class="embed embed-file" data-target="${escapeAttr(target)}" style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-secondary); margin: 4px 0;"><span style="background: var(--accent-color); color: #fff; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 3px; letter-spacing: 0.5px;">${ext}</span><span style="flex: 1; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(target)}</span><a href="/api/vault/raw?path=${encodeURIComponent(target)}" download style="color: var(--accent-color); font-size: 12px; text-decoration: none;">Download ↓</a></div>`;
    }
    return `<div class="embed embed-note" data-target="${escapeAttr(target)}"><span class="embed-label">${escapeHtml(target)}</span></div>`;
  };

  // Plugin: inline math $...$
  md.inline.ruler.after("escape", "math_inline", mathInlineRule);
  md.renderer.rules.math_inline = (tokens, idx) => {
    try {
      return katex.renderToString(tokens[idx].content, { throwOnError: false });
    } catch {
      return `<code>${escapeHtml(tokens[idx].content)}</code>`;
    }
  };

  // Plugin: display math $$...$$
  md.block.ruler.after("fence", "math_block", mathBlockRule, {
    alt: ["paragraph", "reference", "blockquote", "list"],
  });
  md.renderer.rules.math_block = (tokens, idx) => {
    try {
      return `<div class="math-display">${katex.renderToString(tokens[idx].content, { throwOnError: false, displayMode: true })}</div>`;
    } catch {
      return `<pre><code>${escapeHtml(tokens[idx].content)}</code></pre>`;
    }
  };

  // Plugin: ==highlight== (Obsidian mark syntax)
  md.inline.ruler.push("highlight_mark", highlightRule);
  md.renderer.rules.highlight_mark = (tokens, idx) => {
    return `<mark>${escapeHtml(tokens[idx].content)}</mark>`;
  };

  // Plugin: !!spoiler!! (blur text, reveal on click)
  md.inline.ruler.push("spoiler_text", spoilerRule);
  md.renderer.rules.spoiler_text = (tokens, idx) => {
    return `<span class="spoiler" onclick="this.classList.toggle('revealed')">${escapeHtml(tokens[idx].content)}</span>`;
  };

  // Plugin: inline tags #tag
  md.inline.ruler.push("obsidian_tag", tagRule);
  md.renderer.rules.obsidian_tag = (tokens, idx) => {
    const token = tokens[idx];
    const tag = token.meta.tag as string;
    return `<span class="tag" data-tag="${escapeAttr(tag)}" style="cursor:pointer">#${escapeHtml(tag)}</span>`;
  };

  // Plugin: task lists
  md.renderer.rules.list_item_open = (tokens, idx, options, _env, self) => {
    const token = tokens[idx];
    if (token.attrGet("class")?.includes("task-list-item")) {
      return '<li class="task-list-item">';
    }
    return self.renderToken(tokens, idx, options);
  };

  // Override checkbox rendering in list items
  const origParagraphOpen = md.renderer.rules.paragraph_open;
  md.core.ruler.push("task_lists", (state) => {
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type !== "inline") continue;
      const children = tokens[i].children;
      if (!children || children.length === 0) continue;
      const first = children[0];
      if (first.type !== "text") continue;

      const checkMatch = /^\[([ xX/\->!?*])\]\s*/.exec(first.content);
      if (!checkMatch) continue;

      const marker = checkMatch[1];
      const checked = marker === "x" || marker === "X";
      const isAlternative = "/->!?*".includes(marker);
      first.content = first.content.slice(checkMatch[0].length);

      const checkbox = new state.Token("html_inline", "", 0);
      if (isAlternative) {
        const labels: Record<string, string> = {
          "/": "◐", "-": "—", ">": "▸", "!": "!", "?": "?", "*": "★",
        };
        const colors: Record<string, string> = {
          "/": "#e6994a", "-": "#888", ">": "#4ea8de", "!": "#ff6b6b", "?": "#c084fc", "*": "#fbbf24",
        };
        checkbox.content = `<span class="alt-checkbox" data-task="${marker}" style="display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 3px; border: 1.5px solid ${colors[marker]}; color: ${colors[marker]}; font-size: 11px; font-weight: 700; margin-right: 5px; vertical-align: middle; flex-shrink: 0;">${labels[marker]}</span>`;
      } else {
        checkbox.content = `<input type="checkbox" ${checked ? "checked" : ""} disabled /> `;
      }
      children.unshift(checkbox);

      // Mark parent list_item
      for (let j = i - 1; j >= 0; j--) {
        if (tokens[j].type === "list_item_open") {
          tokens[j].attrSet("class", `task-list-item${isAlternative ? ` task-${marker === "*" ? "star" : marker === "!" ? "important" : marker === "?" ? "question" : marker === ">" ? "deferred" : marker === "-" ? "cancelled" : "partial"}` : ""}`);
          break;
        }
      }
    }
  });

  // Plugin: callouts (admonitions) — transform blockquotes starting with [!type]
  md.core.ruler.push("callouts", (state) => {
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type !== "blockquote_open") continue;

      // Find the first inline content inside this blockquote
      let inlineIdx = -1;
      for (let j = i + 1; j < tokens.length; j++) {
        if (tokens[j].type === "blockquote_close") break;
        if (tokens[j].type === "inline") {
          inlineIdx = j;
          break;
        }
      }
      if (inlineIdx === -1) continue;

      const inline = tokens[inlineIdx];
      const calloutMatch = /^\[!(\w+)\]([+-])?\s*(.*)/.exec(inline.content);
      if (!calloutMatch) continue;

      const type = calloutMatch[1].toLowerCase();
      const fold = calloutMatch[2] || ""; // "+" = open, "-" = collapsed, "" = no fold
      const title = calloutMatch[3] || type.charAt(0).toUpperCase() + type.slice(1);

      // Strip the callout marker from the inline content
      // Remove the first line (callout marker) from children too
      if (inline.children && inline.children.length > 0) {
        const firstChild = inline.children[0];
        if (firstChild.type === "text") {
          const nlIdx = firstChild.content.indexOf("\n");
          if (nlIdx !== -1) {
            firstChild.content = firstChild.content.slice(nlIdx + 1);
          } else {
            // Only content was the callout line — remove it
            inline.children.shift();
            // Also remove a softbreak if it follows
            if (inline.children.length > 0 && inline.children[0].type === "softbreak") {
              inline.children.shift();
            }
          }
        }
      }

      // Update inline.content to remove the callout marker line
      const nlPos = inline.content.indexOf("\n");
      inline.content = nlPos !== -1 ? inline.content.slice(nlPos + 1) : "";

      // Replace blockquote_open with callout wrapper
      const color = CALLOUT_COLORS[type] || CALLOUT_COLORS.note;
      const icon = CALLOUT_ICONS[type] || CALLOUT_ICONS.note;
      const isCollapsible = fold === "+" || fold === "-";
      const isOpen = fold !== "-";

      if (isCollapsible) {
        tokens[i] = Object.assign(new state.Token("html_block", "", 0), {
          content: `<details class="callout callout-${escapeAttr(type)}" style="border-left: 3px solid ${color}; background: ${color}15; border-radius: 4px; margin: 8px 0; padding: 0;"${isOpen ? " open" : ""}><summary style="display: flex; align-items: center; gap: 6px; padding: 8px 12px; cursor: pointer; font-weight: 600; color: ${color};"><span>${icon}</span> ${escapeHtml(title)}</summary><div style="padding: 4px 12px 8px 12px;">`,
        });
      } else {
        tokens[i] = Object.assign(new state.Token("html_block", "", 0), {
          content: `<div class="callout callout-${escapeAttr(type)}" style="border-left: 3px solid ${color}; background: ${color}15; border-radius: 4px; margin: 8px 0; padding: 0;"><div style="display: flex; align-items: center; gap: 6px; padding: 8px 12px; font-weight: 600; color: ${color};"><span>${icon}</span> ${escapeHtml(title)}</div><div style="padding: 4px 12px 8px 12px;">`,
        });
      }

      // Find and replace the matching blockquote_close (respecting nesting depth)
      let depth = 1;
      for (let j = i + 1; j < tokens.length; j++) {
        if (tokens[j].type === "blockquote_open") depth++;
        else if (tokens[j].type === "blockquote_close") {
          depth--;
          if (depth === 0) {
            tokens[j] = Object.assign(new state.Token("html_block", "", 0), {
              content: isCollapsible ? `</div></details>` : `</div></div>`,
            });
            break;
          }
        }
      }
    }
  });

  // Open external links in new tab
  const defaultLinkRender = md.renderer.rules.link_open || ((tokens: any[], idx: number, options: any, _env: any, self: any) => self.renderToken(tokens, idx, options));
  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const href = tokens[idx].attrGet("href");
    if (href && /^https?:\/\//.test(href)) {
      tokens[idx].attrSet("target", "_blank");
      tokens[idx].attrSet("rel", "noopener noreferrer");
    }
    return defaultLinkRender(tokens, idx, options, env, self);
  };

  return md;
}

export const CALLOUT_COLORS: Record<string, string> = {
  note: "#448aff",
  info: "#448aff",
  abstract: "#00b0ff",
  summary: "#00b0ff",
  tip: "#00bfa5",
  hint: "#00bfa5",
  success: "#00c853",
  check: "#00c853",
  done: "#00c853",
  question: "#ff9100",
  help: "#ff9100",
  faq: "#ff9100",
  warning: "#ff9100",
  caution: "#ff9100",
  attention: "#ff9100",
  danger: "#ff1744",
  error: "#ff1744",
  bug: "#ff1744",
  failure: "#ff1744",
  fail: "#ff1744",
  missing: "#ff1744",
  example: "#7c4dff",
  quote: "#9e9e9e",
  cite: "#9e9e9e",
  todo: "#448aff",
};

function svgIcon(d: string): string {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0">${d}</svg>`;
}

export const CALLOUT_ICONS: Record<string, string> = {
  note: svgIcon('<path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>'),
  info: svgIcon('<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'),
  abstract: svgIcon('<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>'),
  summary: svgIcon('<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>'),
  tip: svgIcon('<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>'),
  hint: svgIcon('<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>'),
  success: svgIcon('<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'),
  check: svgIcon('<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'),
  done: svgIcon('<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'),
  question: svgIcon('<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>'),
  help: svgIcon('<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>'),
  faq: svgIcon('<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>'),
  warning: svgIcon('<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'),
  caution: svgIcon('<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'),
  attention: svgIcon('<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'),
  danger: svgIcon('<polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'),
  error: svgIcon('<polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'),
  bug: svgIcon('<rect width="8" height="14" x="8" y="6" rx="4"/><path d="m19 7-3 2"/><path d="m5 7 3 2"/><path d="m19 19-3-2"/><path d="m5 19 3-2"/><path d="M20 13h-4"/><path d="M4 13h4"/><path d="m10 4 1 2"/><path d="m14 4-1 2"/>'),
  failure: svgIcon('<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>'),
  fail: svgIcon('<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>'),
  missing: svgIcon('<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>'),
  example: svgIcon('<polyline points="14 2 18 6 7 17 3 17 3 13 14 2"/><line x1="3" y1="22" x2="21" y2="22"/>'),
  quote: svgIcon('<path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3z"/>'),
  cite: svgIcon('<path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3z"/>'),
  todo: svgIcon('<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'),
};

// --- Inline rules ---

function wikilinkRule(state: StateInline, silent: boolean): boolean {
  const src = state.src.slice(state.pos);
  if (src[0] !== "[" || src[1] !== "[") return false;
  // Skip embeds
  if (state.pos > 0 && state.src[state.pos - 1] === "!") return false;

  const close = src.indexOf("]]", 2);
  if (close === -1) return false;

  if (!silent) {
    const inner = src.slice(2, close);
    const pipeIdx = inner.indexOf("|");
    const target = pipeIdx === -1 ? inner : inner.slice(0, pipeIdx);
    const display = pipeIdx === -1 ? undefined : inner.slice(pipeIdx + 1);

    const token = state.push("wikilink", "", 0);
    token.meta = { target: target.trim(), display: display?.trim() };
  }

  state.pos += close + 2;
  return true;
}

function embedRule(state: StateInline, silent: boolean): boolean {
  const src = state.src.slice(state.pos);
  if (src[0] !== "!" || src[1] !== "[" || src[2] !== "[") return false;

  const close = src.indexOf("]]", 3);
  if (close === -1) return false;

  if (!silent) {
    const inner = src.slice(3, close).trim();
    const pipeIdx = inner.indexOf("|");
    const target = pipeIdx === -1 ? inner : inner.slice(0, pipeIdx).trim();
    const sizeStr = pipeIdx === -1 ? undefined : inner.slice(pipeIdx + 1).trim();
    const token = state.push("embed", "", 0);
    token.meta = { target, size: sizeStr };
  }

  state.pos += close + 2;
  return true;
}

function tagRule(state: StateInline, silent: boolean): boolean {
  const pos = state.pos;
  const src = state.src;

  if (src[pos] !== "#") return false;
  // Must be preceded by whitespace or start of string
  if (pos > 0 && !/[\s,;(]/.test(src[pos - 1])) return false;
  // Tag name must start with a letter
  if (pos + 1 >= src.length || !/[a-zA-Z]/.test(src[pos + 1])) return false;

  const match = /^#([a-zA-Z][\w/-]*)/.exec(src.slice(pos));
  if (!match) return false;

  if (!silent) {
    const token = state.push("obsidian_tag", "", 0);
    token.meta = { tag: match[1] };
  }

  state.pos += match[0].length;
  return true;
}

// --- Highlight rule ---

function highlightRule(state: StateInline, silent: boolean): boolean {
  const src = state.src;
  const pos = state.pos;
  if (src[pos] !== "=" || src[pos + 1] !== "=") return false;

  const start = pos + 2;
  let end = src.indexOf("==", start);
  if (end === -1) return false;

  const content = src.slice(start, end);
  if (!content) return false;

  if (!silent) {
    const token = state.push("highlight_mark", "", 0);
    token.content = content;
  }

  state.pos = end + 2;
  return true;
}

// --- Spoiler rule ---

function spoilerRule(state: StateInline, silent: boolean): boolean {
  const src = state.src;
  const pos = state.pos;
  if (src[pos] !== "!" || src[pos + 1] !== "!") return false;

  const start = pos + 2;
  let end = src.indexOf("!!", start);
  if (end === -1) return false;

  const content = src.slice(start, end);
  if (!content) return false;

  if (!silent) {
    const token = state.push("spoiler_text", "", 0);
    token.content = content;
  }

  state.pos = end + 2;
  return true;
}

// --- Math rules ---

function mathInlineRule(state: StateInline, silent: boolean): boolean {
  const src = state.src;
  const pos = state.pos;
  if (src[pos] !== "$") return false;
  // Don't match $$ (that's display math)
  if (src[pos + 1] === "$") return false;

  const start = pos + 1;
  let end = start;
  while (end < src.length) {
    if (src[end] === "$" && src[end - 1] !== "\\") break;
    end++;
  }
  if (end >= src.length) return false;
  const content = src.slice(start, end).trim();
  if (!content) return false;

  if (!silent) {
    const token = state.push("math_inline", "", 0);
    token.content = content;
  }

  state.pos = end + 1;
  return true;
}

function mathBlockRule(state: StateBlock, startLine: number, endLine: number, silent: boolean): boolean {
  const startPos = state.bMarks[startLine] + state.tShift[startLine];
  const maxPos = state.eMarks[startLine];
  const lineText = state.src.slice(startPos, maxPos);

  if (!lineText.startsWith("$$")) return false;

  // Single-line: $$...$$
  if (lineText.length > 4 && lineText.endsWith("$$")) {
    if (silent) return true;
    const token = state.push("math_block", "", 0);
    token.content = lineText.slice(2, -2).trim();
    token.map = [startLine, startLine + 1];
    state.line = startLine + 1;
    return true;
  }

  // Multi-line: find closing $$
  let nextLine = startLine + 1;
  while (nextLine < endLine) {
    const nPos = state.bMarks[nextLine] + state.tShift[nextLine];
    const nMax = state.eMarks[nextLine];
    const nLine = state.src.slice(nPos, nMax);
    if (nLine.trim() === "$$") break;
    nextLine++;
  }
  if (nextLine >= endLine) return false;
  if (silent) return true;

  const content = state.getLines(startLine + 1, nextLine, state.tShift[startLine], false).trim();
  const token = state.push("math_block", "", 0);
  token.content = content;
  token.map = [startLine, nextLine + 1];
  state.line = nextLine + 1;
  return true;
}

// --- Helpers ---

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, "&quot;");
}
