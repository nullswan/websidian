import MarkdownIt from "markdown-it";
// @ts-expect-error — no types available
import footnotePlugin from "markdown-it-footnote";
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

  // Plugin: wikilinks [[target]] and [[target|display]]
  md.inline.ruler.push("wikilink", wikilinkRule);
  md.renderer.rules.wikilink = (tokens, idx) => {
    const token = tokens[idx];
    const target = token.meta.target as string;
    // Display: explicit alias > basename (strip path + heading + .md)
    const display = (token.meta.display as string) || target.split("/").pop()?.replace(/\.md$/, "") || target;
    const href = `#/note/${encodeURIComponent(target)}`;
    return `<a class="wikilink" href="${href}" data-target="${escapeAttr(target)}">${escapeHtml(display)}</a>`;
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

      // Find and replace blockquote_close
      for (let j = inlineIdx + 1; j < tokens.length; j++) {
        if (tokens[j].type === "blockquote_close") {
          tokens[j] = Object.assign(new state.Token("html_block", "", 0), {
            content: isCollapsible ? `</div></details>` : `</div></div>`,
          });
          break;
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

export const CALLOUT_ICONS: Record<string, string> = {
  note: "📝",
  info: "ℹ️",
  abstract: "📋",
  summary: "📋",
  tip: "💡",
  hint: "💡",
  success: "✅",
  check: "✅",
  done: "✅",
  question: "❓",
  help: "❓",
  faq: "❓",
  warning: "⚠️",
  caution: "⚠️",
  attention: "⚠️",
  danger: "🔴",
  error: "🔴",
  bug: "🐛",
  failure: "❌",
  fail: "❌",
  missing: "❌",
  example: "📎",
  quote: "💬",
  cite: "💬",
  todo: "☑️",
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
