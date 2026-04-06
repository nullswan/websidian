import { useEffect, useRef } from "react";
import { EditorView, keymap, highlightActiveLine, lineNumbers, Decoration, ViewPlugin, DecorationSet, WidgetType } from "@codemirror/view";
import { EditorState, RangeSetBuilder, StateField, Compartment } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { syntaxHighlighting, HighlightStyle, syntaxTree, bracketMatching, indentUnit, foldService, foldGutter, codeFolding, foldKeymap } from "@codemirror/language";
import { tags, classHighlighter } from "@lezer/highlight";
import { oneDarkTheme } from "@codemirror/theme-one-dark";
import { autocompletion, closeBrackets, closeBracketsKeymap, CompletionContext, type Completion } from "@codemirror/autocomplete";
import { search, searchKeymap } from "@codemirror/search";
import { vim } from "@replit/codemirror-vim";
import { createMarkdownRenderer } from "../lib/markdown.js";

interface EditorProps {
  content: string;
  filePath: string;
  onSave: (content: string) => void;
  onNavigate?: (target: string) => void;
  onCursorChange?: (info: { line: number; col: number; selectedChars: number }) => void;
  onExtractSelection?: (selectedText: string, replaceWith: (text: string) => void) => void;
  onDirty?: () => void;
  fontSize?: number;
  spellCheck?: boolean;
  showLineNumbers?: boolean;
  tabSize?: number;
  scrollToHeadingRef?: React.MutableRefObject<((heading: string, level: number) => void) | null>;
  typewriterMode?: boolean;
  focusMode?: boolean;
  vimMode?: boolean;
}

// Obsidian-like highlight style for markdown Live Preview
const obsidianHighlight = HighlightStyle.define([
  { tag: tags.heading1, fontSize: "1.8em", fontWeight: "700", color: "#e0e0e0" },
  { tag: tags.heading2, fontSize: "1.5em", fontWeight: "600", color: "#e0e0e0" },
  { tag: tags.heading3, fontSize: "1.25em", fontWeight: "600", color: "#e0e0e0" },
  { tag: tags.heading4, fontSize: "1.1em", fontWeight: "600", color: "#ddd" },
  { tag: tags.heading5, fontSize: "1.05em", fontWeight: "600", color: "#ccc" },
  { tag: tags.heading6, fontSize: "1em", fontWeight: "600", color: "#bbb" },
  { tag: tags.strong, fontWeight: "bold", color: "#e0e0e0" },
  { tag: tags.emphasis, fontStyle: "italic", color: "#dcddde" },
  { tag: tags.strikethrough, textDecoration: "line-through", color: "#888" },
  { tag: tags.link, color: "#7f6df2", textDecoration: "none" },
  { tag: tags.url, color: "#7f6df2", opacity: "0.6" },
  { tag: tags.monospace, fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace", backgroundColor: "rgba(255,255,255,0.06)", padding: "1px 4px", borderRadius: "3px", fontSize: "0.9em" },
  { tag: tags.processingInstruction, color: "#e6994a" }, // tags (#tag) — Obsidian orange
  { tag: tags.meta, color: "#555" }, // frontmatter delimiters — dimmer
  { tag: tags.quote, color: "#aaa", fontStyle: "italic" },
  { tag: tags.list, color: "#7f6df2" }, // list markers
]);

// Line decorations for heading lines (add padding/margin like Obsidian)
const headingLineDecoration: Record<string, Decoration> = {
  ATXHeading1: Decoration.line({ class: "cm-heading-line cm-heading-1" }),
  ATXHeading2: Decoration.line({ class: "cm-heading-line cm-heading-2" }),
  ATXHeading3: Decoration.line({ class: "cm-heading-line cm-heading-3" }),
  ATXHeading4: Decoration.line({ class: "cm-heading-line cm-heading-4" }),
  ATXHeading5: Decoration.line({ class: "cm-heading-line cm-heading-5" }),
  ATXHeading6: Decoration.line({ class: "cm-heading-line cm-heading-6" }),
};

const headingPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = this.buildDecorations(view);
    }
    update(update: { docChanged: boolean; viewportChanged: boolean; selectionSet: boolean; view: EditorView }) {
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = this.buildDecorations(update.view);
      }
    }
    buildDecorations(view: EditorView) {
      const builder = new RangeSetBuilder<Decoration>();
      const tree = syntaxTree(view.state);
      const addedLines = new Set<number>();
      tree.iterate({
        enter: (node) => {
          const deco = headingLineDecoration[node.name];
          if (deco) {
            const line = view.state.doc.lineAt(node.from);
            if (!addedLines.has(line.number)) {
              addedLines.add(line.number);
              builder.add(line.from, line.from, deco);
            }
          }
        },
      });
      return builder.finish();
    }
  },
  { decorations: (v) => v.decorations },
);

// Frontmatter Properties widget — replaces raw YAML with a structured panel
class FrontmatterWidget extends WidgetType {
  properties: Array<{ key: string; value: string }>;
  constructor(properties: Array<{ key: string; value: string }>) {
    super();
    this.properties = properties;
  }
  toDOM() {
    const container = document.createElement("div");
    container.className = "cm-frontmatter-widget";

    const header = document.createElement("div");
    header.className = "cm-frontmatter-header";
    header.textContent = "Properties";
    header.style.cursor = "pointer";
    container.appendChild(header);

    const body = document.createElement("div");
    body.className = "cm-frontmatter-body";
    for (const { key, value } of this.properties) {
      const row = document.createElement("div");
      row.className = "cm-frontmatter-row";
      const keyEl = document.createElement("span");
      keyEl.className = "cm-frontmatter-key";
      keyEl.textContent = key;
      const valEl = document.createElement("span");
      valEl.className = "cm-frontmatter-value";
      valEl.textContent = value;
      row.appendChild(keyEl);
      row.appendChild(valEl);
      body.appendChild(row);
    }
    container.appendChild(body);
    return container;
  }
  eq(other: FrontmatterWidget) {
    return JSON.stringify(this.properties) === JSON.stringify(other.properties);
  }
  ignoreEvent() { return true; }
}

function parseFrontmatterRange(doc: { toString: () => string }): { from: number; to: number; properties: Array<{ key: string; value: string }> } | null {
  const text = doc.toString();
  if (!text.startsWith("---")) return null;
  const endIdx = text.indexOf("\n---", 3);
  if (endIdx === -1) return null;
  const to = endIdx + 4; // include closing ---
  // Find end of closing --- line
  const lineEnd = text.indexOf("\n", to);
  const realTo = lineEnd === -1 ? to : lineEnd;

  const yaml = text.slice(4, endIdx);
  const properties: Array<{ key: string; value: string }> = [];
  let currentKey = "";
  let currentValues: string[] = [];

  const flushKey = () => {
    if (currentKey) {
      properties.push({ key: currentKey, value: currentValues.join(", ") });
    }
    currentKey = "";
    currentValues = [];
  };

  for (const line of yaml.split("\n")) {
    const kvMatch = line.match(/^(\w[\w-]*):\s*(.*)/);
    if (kvMatch) {
      flushKey();
      currentKey = kvMatch[1];
      if (kvMatch[2].trim()) {
        currentValues.push(kvMatch[2].trim());
      }
    } else {
      // Array item or continuation
      const itemMatch = line.match(/^\s*-\s+(.*)/);
      if (itemMatch && currentKey) {
        currentValues.push(itemMatch[1].trim());
      }
    }
  }
  flushKey();

  return { from: 0, to: realTo, properties };
}

function buildFrontmatterDecorations(state: EditorState): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const fm = parseFrontmatterRange(state.doc);
  if (!fm) return builder.finish();

  // Show raw YAML when cursor is inside frontmatter
  const cursor = state.selection.main.head;
  if (cursor >= fm.from && cursor <= fm.to) {
    return builder.finish();
  }

  builder.add(fm.from, fm.to, Decoration.replace({
    widget: new FrontmatterWidget(fm.properties),
  }));
  return builder.finish();
}

const frontmatterField = StateField.define<DecorationSet>({
  create(state) { return buildFrontmatterDecorations(state); },
  update(decos, tr) {
    if (tr.docChanged || tr.selection) {
      return buildFrontmatterDecorations(tr.state);
    }
    return decos;
  },
  provide: (f) => EditorView.decorations.from(f),
});

// Inline image preview widget for Live Preview (![[image]] and ![alt](url))
class ImagePreviewWidget extends WidgetType {
  src: string;
  constructor(src: string) {
    super();
    this.src = src;
  }
  toDOM() {
    const wrapper = document.createElement("div");
    wrapper.className = "cm-image-preview";
    wrapper.style.cssText = "padding: 4px 0; max-width: 600px;";
    const img = document.createElement("img");
    img.src = this.src;
    img.style.cssText = "max-width: 100%; border-radius: 6px; display: block;";
    img.loading = "lazy";
    img.onerror = () => { wrapper.style.display = "none"; };
    wrapper.appendChild(img);
    return wrapper;
  }
  eq(other: ImagePreviewWidget) {
    return this.src === other.src;
  }
  ignoreEvent() { return true; }
}

function resolveImageSrc(raw: string): string {
  // External URL
  if (/^https?:\/\//.test(raw)) return raw;
  // Vault image: use /api/vault/raw
  return `/api/vault/raw?path=${encodeURIComponent(raw)}`;
}

const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|svg|webp|bmp|ico|avif)$/i;

function buildImageDecorations(state: EditorState): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const cursorLine = state.doc.lineAt(state.selection.main.head).number;

  for (let i = 1; i <= state.doc.lines; i++) {
    if (i === cursorLine) continue; // hide preview when editing that line
    const line = state.doc.line(i);
    const text = line.text;

    // ![[image.png]] — wikilink embed
    const wikiMatch = text.match(/^!\[\[([^\]|#]+?)(?:\|[^\]]*?)?\]\]\s*$/);
    if (wikiMatch && IMAGE_EXTENSIONS.test(wikiMatch[1])) {
      builder.add(
        line.to,
        line.to,
        Decoration.widget({ widget: new ImagePreviewWidget(resolveImageSrc(wikiMatch[1].trim())), block: true, side: 1 }),
      );
      continue;
    }

    // ![alt](url) — standard markdown image
    const mdMatch = text.match(/^!\[([^\]]*)\]\(([^)]+)\)\s*$/);
    if (mdMatch) {
      builder.add(
        line.to,
        line.to,
        Decoration.widget({ widget: new ImagePreviewWidget(resolveImageSrc(mdMatch[2].trim())), block: true, side: 1 }),
      );
    }
  }
  return builder.finish();
}

const imagePreviewField = StateField.define<DecorationSet>({
  create(state) { return buildImageDecorations(state); },
  update(decos, tr) {
    if (tr.docChanged || tr.selection) {
      return buildImageDecorations(tr.state);
    }
    return decos;
  },
  provide: (f) => EditorView.decorations.from(f),
});

// Clickable checkbox widget for Live Preview (replaces [ ] and [x] inline)
class CheckboxWidget extends WidgetType {
  checked: boolean;
  constructor(checked: boolean) {
    super();
    this.checked = checked;
  }
  toDOM(view: EditorView) {
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = this.checked;
    input.style.cssText = "cursor: pointer; accent-color: #7f6df2; vertical-align: middle; margin-right: 4px;";
    input.addEventListener("mousedown", (e) => {
      e.preventDefault();
      // Find this widget's position and toggle
      const pos = view.posAtDOM(input);
      const line = view.state.doc.lineAt(pos);
      const match = line.text.match(/^(\s*- \[)([ x])(\])/);
      if (match) {
        const bracketStart = line.from + match[1].length;
        const newChar = match[2] === "x" ? " " : "x";
        view.dispatch({ changes: { from: bracketStart, to: bracketStart + 1, insert: newChar } });
      }
    });
    return input;
  }
  eq(other: CheckboxWidget) {
    return this.checked === other.checked;
  }
  ignoreEvent() { return false; } // allow click events to reach the widget
}

function buildCheckboxDecorations(state: EditorState): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const cursorLine = state.doc.lineAt(state.selection.main.head).number;

  for (let i = 1; i <= state.doc.lines; i++) {
    if (i === cursorLine) continue; // show raw syntax on active line
    const line = state.doc.line(i);
    const match = line.text.match(/^(\s*- \[)([ x])(\])/);
    if (match) {
      const checkStart = line.from + match[1].length - 1; // start of [
      const checkEnd = line.from + match[1].length + match[2].length + match[3].length; // end of ]
      builder.add(
        checkStart,
        checkEnd,
        Decoration.replace({ widget: new CheckboxWidget(match[2] === "x") }),
      );
    }
  }
  return builder.finish();
}

const checkboxField = StateField.define<DecorationSet>({
  create(state) { return buildCheckboxDecorations(state); },
  update(decos, tr) {
    if (tr.docChanged || tr.selection) {
      return buildCheckboxDecorations(tr.state);
    }
    return decos;
  },
  provide: (f) => EditorView.decorations.from(f),
});

// Heading marker widget — zero-width replacement to hide # markers
class HeadingMarkerWidget extends WidgetType {
  toDOM() {
    const span = document.createElement("span");
    span.style.cssText = "width: 0; display: inline-block; overflow: hidden;";
    return span;
  }
  eq() { return true; }
  ignoreEvent() { return true; }
}

// Horizontal rule widget — renders --- as a visual line
class HRWidget extends WidgetType {
  toDOM() {
    const hr = document.createElement("hr");
    hr.style.cssText = "border: none; border-top: 1px solid #333; margin: 8px 0;";
    return hr;
  }
  eq() { return true; }
  ignoreEvent() { return true; }
}

// Bullet widget — renders list marker as a dot
class BulletWidget extends WidgetType {
  indent: string;
  constructor(indent: string) {
    super();
    this.indent = indent;
  }
  toDOM() {
    const span = document.createElement("span");
    span.textContent = this.indent + "• ";
    span.style.color = "#7f6df2";
    return span;
  }
  eq(other: BulletWidget) { return this.indent === other.indent; }
  ignoreEvent() { return true; }
}

// Numbered list widget — renders styled number
class NumberedListWidget extends WidgetType {
  indent: string;
  num: string;
  constructor(indent: string, num: string) {
    super();
    this.indent = indent;
    this.num = num;
  }
  toDOM() {
    const span = document.createElement("span");
    span.textContent = this.indent + this.num + ". ";
    span.style.color = "#7f6df2";
    return span;
  }
  eq(other: NumberedListWidget) { return this.indent === other.indent && this.num === other.num; }
  ignoreEvent() { return true; }
}

function buildLivePreviewDecorations(state: EditorState): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const cursorLine = state.doc.lineAt(state.selection.main.head).number;
  // Skip frontmatter region
  const fm = parseFrontmatterRange(state.doc);
  const fmEndLine = fm ? state.doc.lineAt(Math.min(fm.to, state.doc.length)).number : 0;

  for (let i = 1; i <= state.doc.lines; i++) {
    if (i === cursorLine) continue;
    if (i <= fmEndLine) continue;
    const line = state.doc.line(i);
    const text = line.text;

    // Heading: hide # markers on non-active lines
    const headingMatch = text.match(/^(#{1,6})\s/);
    if (headingMatch) {
      builder.add(line.from, line.from + headingMatch[1].length + 1, Decoration.replace({
        widget: new HeadingMarkerWidget(),
      }));
      continue;
    }

    // Horizontal rule: ---, ***, ___ (with optional spaces)
    if (/^(\s*[-*_]){3,}\s*$/.test(text) && !/^\s*-\s/.test(text)) {
      builder.add(line.from, line.to, Decoration.replace({ widget: new HRWidget() }));
      continue;
    }

    // Unordered list bullet (but not checkboxes — those are handled separately)
    const bulletMatch = text.match(/^(\s*)- (?!\[[ x]\])/);
    if (bulletMatch) {
      builder.add(line.from, line.from + bulletMatch[0].length, Decoration.replace({ widget: new BulletWidget(bulletMatch[1]) }));
      continue;
    }

    // Ordered list: 1. 2. etc. — render styled number
    const olMatch = text.match(/^(\s*)(\d+)\.\s/);
    if (olMatch) {
      builder.add(line.from, line.from + olMatch[0].length, Decoration.replace({ widget: new NumberedListWidget(olMatch[1], olMatch[2]) }));
      continue;
    }

    // Blockquote: add left-border line decoration and hide > marker
    const bqMatch = text.match(/^(\s*>+)\s?/);
    if (bqMatch) {
      const depth = (bqMatch[1].match(/>/g) || []).length;
      builder.add(line.from, line.from, Decoration.line({
        class: `cm-blockquote cm-blockquote-${Math.min(depth, 3)}`,
      }));
      // Hide the > markers on non-active lines
      builder.add(line.from, line.from + bqMatch[0].length, Decoration.replace({
        widget: new BlockquoteMarkerWidget(bqMatch[1].replace(/[^>]/g, "").length),
      }));
    }
  }
  return builder.finish();
}

class BlockquoteMarkerWidget extends WidgetType {
  depth: number;
  constructor(depth: number) {
    super();
    this.depth = depth;
  }
  toDOM() {
    const span = document.createElement("span");
    span.style.cssText = "width: 0; display: inline-block; overflow: hidden;";
    return span;
  }
  eq(other: BlockquoteMarkerWidget) { return this.depth === other.depth; }
  ignoreEvent() { return true; }
}

const livePreviewWidgetsField = StateField.define<DecorationSet>({
  create(state) { return buildLivePreviewDecorations(state); },
  update(decos, tr) {
    if (tr.docChanged || tr.selection) {
      return buildLivePreviewDecorations(tr.state);
    }
    return decos;
  },
  provide: (f) => EditorView.decorations.from(f),
});

// Zero-width widget for hiding inline markers (**, *, ~~)
class InlineMarkerWidget extends WidgetType {
  toDOM() {
    const span = document.createElement("span");
    span.style.cssText = "width: 0; display: inline-block; overflow: hidden;";
    return span;
  }
  eq() { return true; }
  ignoreEvent() { return true; }
}

const inlineMarkerWidget = new InlineMarkerWidget();

function buildInlineMarkerDecorations(state: EditorState): DecorationSet {
  const cursorLine = state.doc.lineAt(state.selection.main.head).number;
  const ranges: Array<{ from: number; to: number }> = [];

  // Syntax tree: EmphasisMark covers ** and * delimiters
  const tree = syntaxTree(state);
  tree.iterate({
    enter: (node) => {
      if (node.name === "EmphasisMark" || node.name === "CodeMark") {
        const line = state.doc.lineAt(node.from);
        if (line.number !== cursorLine) {
          ranges.push({ from: node.from, to: node.to });
        }
      }
    },
  });

  // Regex: ~~ strikethrough and == highlight markers (not in Lezer tree)
  for (let i = 1; i <= state.doc.lines; i++) {
    if (i === cursorLine) continue;
    const line = state.doc.line(i);
    const text = line.text;
    // ~~text~~ strikethrough — hide all ~~ pairs
    let m;
    const stRegex = /~~/g;
    while ((m = stRegex.exec(text)) !== null) {
      ranges.push({ from: line.from + m.index, to: line.from + m.index + 2 });
    }
    // ==text== highlight — hide all == pairs
    const hlRegex = /==/g;
    while ((m = hlRegex.exec(text)) !== null) {
      ranges.push({ from: line.from + m.index, to: line.from + m.index + 2 });
    }
  }

  // Sort by position for RangeSetBuilder
  ranges.sort((a, b) => a.from - b.from || a.to - b.to);

  const builder = new RangeSetBuilder<Decoration>();
  for (const r of ranges) {
    builder.add(r.from, r.to, Decoration.replace({ widget: inlineMarkerWidget }));
  }
  return builder.finish();
}

const inlineMarkerField = StateField.define<DecorationSet>({
  create(state) { return buildInlineMarkerDecorations(state); },
  update(decos, tr) {
    if (tr.docChanged || tr.selection) {
      return buildInlineMarkerDecorations(tr.state);
    }
    return decos;
  },
  provide: (f) => EditorView.decorations.from(f),
});

// Custom theme overrides for Live Preview feel — using CSS classes for heading colors
// because HighlightStyle can't override oneDark's heading color reliably
const livePreviewTheme = EditorView.theme({
  "&": {
    fontSize: "16px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
    backgroundColor: "#1e1e1e",
  },
  "&.cm-focused": {
    outline: "none",
  },
  ".cm-content": {
    padding: "16px 48px",
    maxWidth: "750px",
    caretColor: "#7f6df2",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
  },
  ".cm-scroller": {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
  },
  ".cm-line": {
    lineHeight: "1.65",
    padding: "0",
  },
  ".cm-heading-line": {
    paddingTop: "10px",
  },
  ".cm-heading-1": { paddingBottom: "4px", borderBottom: "1px solid rgba(255,255,255,0.08)" },
  ".cm-heading-2": { paddingBottom: "2px" },
  ".cm-activeLine": {
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  ".cm-gutters": {
    background: "#1e1e1e",
    borderRight: "1px solid #2a2a2a",
    color: "#555",
  },
  ".cm-foldGutter": {
    width: "16px",
  },
  ".cm-foldGutter .cm-gutterElement": {
    padding: "0 2px",
    transition: "color 0.15s",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  ".cm-foldGutter .cm-gutterElement:hover span": {
    color: "#bbb !important",
  },
  ".cm-foldPlaceholder": {
    background: "rgba(127, 109, 242, 0.1)",
    border: "1px solid rgba(127, 109, 242, 0.3)",
    borderRadius: "3px",
    color: "#7f6df2",
    padding: "0 6px",
    margin: "0 4px",
  },
  ".cm-cursor": {
    borderLeftColor: "#7f6df2",
    borderLeftWidth: "2px",
  },
  // Dim the heading markers (# ## ###) — Obsidian fades these
  ".tok-heading .tok-meta": {
    color: "#555 !important",
    fontWeight: "normal",
  },
  // Dim wikilink brackets [[ ]]
  ".tok-link": {
    color: "#7f6df2",
  },
  // Blockquote styling
  ".cm-blockquote": {
    borderLeft: "3px solid #7f6df2",
    paddingLeft: "12px",
    color: "#aaa",
    fontStyle: "italic",
  },
  ".cm-blockquote-2": {
    borderLeft: "3px solid #7f6df2",
    paddingLeft: "12px",
    marginLeft: "16px",
  },
  ".cm-blockquote-3": {
    borderLeft: "3px solid #7f6df2",
    paddingLeft: "12px",
    marginLeft: "32px",
  },
  // Scrollbar styling
  ".cm-scroller::-webkit-scrollbar": {
    width: "8px",
  },
  ".cm-scroller::-webkit-scrollbar-thumb": {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: "4px",
  },
});

// Wikilink autocomplete: triggers after [[
async function tagCompletion(ctx: CompletionContext) {
  const line = ctx.state.doc.lineAt(ctx.pos);
  const textBefore = line.text.slice(0, ctx.pos - line.from);
  // Match #tag pattern (not inside wikilinks or code)
  const match = /#([\w\-/]*)$/.exec(textBefore);
  if (!match) return null;
  // Don't trigger inside markdown headings (## etc)
  if (/^#{1,6}\s/.test(line.text)) return null;

  const query = match[1].toLowerCase();
  const from = ctx.pos - match[1].length;

  try {
    const res = await fetch("/api/vault/tags", { credentials: "include" });
    const data = await res.json();
    const options: Completion[] = (data.tags ?? [])
      .filter((t: { name: string }) => t.name.toLowerCase().includes(query))
      .slice(0, 20)
      .map((t: { name: string; count: number }) => ({
        label: t.name,
        detail: `${t.count}`,
        type: "keyword",
      }));
    return { from, options, filter: false };
  } catch {
    return null;
  }
}

async function wikilinkCompletion(ctx: CompletionContext) {
  // Look backwards for [[ to find the trigger
  const line = ctx.state.doc.lineAt(ctx.pos);
  const textBefore = line.text.slice(0, ctx.pos - line.from);
  const match = /\[\[([^\]|]*)$/.exec(textBefore);
  if (!match) return null;

  const query = match[1];
  const from = ctx.pos - query.length;

  try {
    const res = await fetch(`/api/vault/switcher?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    const candidates: Completion[] = (data.candidates ?? []).map((c: { path: string; name: string }) => ({
      label: c.name,
      detail: c.path.includes("/") ? c.path.split("/").slice(0, -1).join("/") : undefined,
      apply: (view: EditorView, _completion: Completion, from: number, to: number) => {
        // Insert note name and close with ]]
        const insertText = c.path.replace(/\.md$/, "") + "]]";
        view.dispatch({ changes: { from, to, insert: insertText } });
      },
    }));
    return { from, options: candidates, filter: false };
  } catch {
    return null;
  }
}

// Slash commands: type / at start of line for quick markdown insertion
function slashCompletion(ctx: CompletionContext) {
  const line = ctx.state.doc.lineAt(ctx.pos);
  const textBefore = line.text.slice(0, ctx.pos - line.from);
  const match = /^\/([\w]*)$/.exec(textBefore);
  if (!match) return null;

  const query = match[1].toLowerCase();
  const from = line.from; // Replace from start of line (including the /)

  const commands: Array<{ label: string; detail: string; insert: string }> = [
    { label: "Heading 1", detail: "# ", insert: "# " },
    { label: "Heading 2", detail: "## ", insert: "## " },
    { label: "Heading 3", detail: "### ", insert: "### " },
    { label: "Heading 4", detail: "#### ", insert: "#### " },
    { label: "Bullet list", detail: "- ", insert: "- " },
    { label: "Numbered list", detail: "1. ", insert: "1. " },
    { label: "Task list", detail: "- [ ] ", insert: "- [ ] " },
    { label: "Quote", detail: "> ", insert: "> " },
    { label: "Code block", detail: "```", insert: "```\n\n```" },
    { label: "Callout", detail: "> [!note]", insert: "> [!note]\n> " },
    { label: "Table", detail: "| |", insert: "| Column 1 | Column 2 |\n| --- | --- |\n| | |" },
    { label: "Horizontal rule", detail: "---", insert: "---" },
    { label: "Math block", detail: "$$", insert: "$$\n\n$$" },
    { label: "Link", detail: "[]()", insert: "[](url)" },
    { label: "Image", detail: "![]()", insert: "![](url)" },
    { label: "Embed", detail: "![[]]", insert: "![[]]" },
  ];

  const filtered = commands.filter((c) =>
    !query || c.label.toLowerCase().includes(query)
  );

  const options: Completion[] = filtered.map((c) => ({
    label: c.label,
    detail: c.detail,
    type: "keyword",
    apply: (view: EditorView, _: Completion, _from: number, to: number) => {
      view.dispatch({
        changes: { from, to, insert: c.insert },
        selection: { anchor: from + c.insert.length },
      });
    },
  }));

  return { from: ctx.pos - match[1].length - 1, options, filter: false };
}

// Markdown heading fold: fold content under a heading until next heading of equal/higher level
const markdownHeadingFold = foldService.of((state, lineStart, _lineEnd) => {
  const line = state.doc.lineAt(lineStart);
  const match = /^(#{1,6})\s/.exec(line.text);
  if (!match) return null;
  const level = match[1].length;
  // Find the end: next heading of same or higher level, or end of doc
  let endLine = line.number;
  for (let i = line.number + 1; i <= state.doc.lines; i++) {
    const nextLine = state.doc.line(i);
    const nextMatch = /^(#{1,6})\s/.exec(nextLine.text);
    if (nextMatch && nextMatch[1].length <= level) {
      break;
    }
    endLine = i;
  }
  if (endLine === line.number) return null; // nothing to fold
  const endPos = state.doc.line(endLine).to;
  return { from: line.to, to: endPos };
});

// Markdown delimiter auto-pairing: **, *, ~~, ==
const markdownAutoPair = EditorView.inputHandler.of((view, from, to, text) => {
  const pairs: Record<string, string> = { "*": "*", "~": "~", "=": "=" };
  if (!pairs[text]) return false;

  const sel = view.state.selection.main;
  const before = from > 0 ? view.state.sliceDoc(from - 1, from) : "";
  const after = view.state.sliceDoc(to, to + 1);

  // If text is selected, wrap it with the delimiter
  if (sel.from !== sel.to) {
    const selected = view.state.sliceDoc(sel.from, sel.to);
    // For **, ~~, == — check if previous char is same to make double
    if (before === text) {
      // Completing a double delimiter — wrap selection
      view.dispatch({
        changes: [
          { from: sel.from - 1, to: sel.from, insert: text + text },
          { from: sel.to, to: sel.to, insert: text + text },
        ],
        selection: { anchor: sel.from + 1, head: sel.to + 1 },
      });
      return true;
    }
    view.dispatch({
      changes: [
        { from: sel.from, to: sel.from, insert: text },
        { from: sel.to, to: sel.to, insert: text },
      ],
      selection: { anchor: sel.from + 1, head: sel.to + 1 },
    });
    return true;
  }

  // Double delimiter: if char before cursor is same char, make pair (e.g. * -> **)
  if (before === text) {
    // Only auto-close if next char is not the same (avoid tripling)
    if (after === text) return false;
    view.dispatch({
      changes: { from, to, insert: text + text },
      selection: { anchor: from + 1 },
    });
    return true;
  }

  return false;
});

export function Editor({ content, filePath, onSave, onNavigate, onCursorChange, onExtractSelection, onDirty, fontSize = 16, spellCheck = false, showLineNumbers = false, tabSize = 4, scrollToHeadingRef, typewriterMode = false, focusMode = false, vimMode = false }: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Compartments for hot-swappable settings (no editor recreation needed)
  const fontSizeComp = useRef(new Compartment());
  const spellCheckComp = useRef(new Compartment());
  const lineNumbersComp = useRef(new Compartment());
  const tabSizeComp = useRef(new Compartment());
  const indentUnitComp = useRef(new Compartment());
  const typewriterComp = useRef(new Compartment());
  const focusModeComp = useRef(new Compartment());
  const vimComp = useRef(new Compartment());

  useEffect(() => {
    if (!containerRef.current) return;

    if (viewRef.current) {
      viewRef.current.destroy();
    }

    // Markdown formatting: wrap selection with markers or toggle if already wrapped
    const wrapWith = (view: EditorView, marker: string): boolean => {
      const sel = view.state.selection.main;
      const selected = view.state.sliceDoc(sel.from, sel.to);
      if (selected.startsWith(marker) && selected.endsWith(marker) && selected.length >= marker.length * 2) {
        // Remove markers
        view.dispatch({ changes: { from: sel.from, to: sel.to, insert: selected.slice(marker.length, -marker.length) } });
      } else if (sel.from >= marker.length && sel.to + marker.length <= view.state.doc.length &&
                 view.state.sliceDoc(sel.from - marker.length, sel.from) === marker &&
                 view.state.sliceDoc(sel.to, sel.to + marker.length) === marker) {
        // Markers surround selection — remove them
        view.dispatch({ changes: [
          { from: sel.from - marker.length, to: sel.from, insert: "" },
          { from: sel.to, to: sel.to + marker.length, insert: "" },
        ] });
      } else {
        // Add markers around selection (or at cursor)
        const insert = marker + selected + marker;
        view.dispatch({
          changes: { from: sel.from, to: sel.to, insert },
          selection: { anchor: sel.from + marker.length, head: sel.from + marker.length + selected.length },
        });
      }
      return true;
    };

    const saveKeymap = keymap.of([
      {
        key: "Mod-s",
        run: (view) => {
          onSave(view.state.doc.toString());
          return true;
        },
      },
      {
        key: "Mod-Shift-n",
        run: (view) => {
          const sel = view.state.selection.main;
          const selected = view.state.sliceDoc(sel.from, sel.to);
          if (!selected.trim() || !onExtractSelection) return false;
          onExtractSelection(selected, (replacement) => {
            view.dispatch({
              changes: { from: sel.from, to: sel.to, insert: replacement },
            });
          });
          return true;
        },
      },
      { key: "Mod-b", run: (view) => wrapWith(view, "**") },
      { key: "Mod-i", run: (view) => wrapWith(view, "*") },
      { key: "Mod-Shift-x", run: (view) => wrapWith(view, "~~") },
      { key: "Mod-`", run: (view) => wrapWith(view, "`") },
      {
        key: "Mod-k",
        run: (view) => {
          const sel = view.state.selection.main;
          const selected = view.state.sliceDoc(sel.from, sel.to);
          if (selected) {
            const insert = `[${selected}](url)`;
            view.dispatch({
              changes: { from: sel.from, to: sel.to, insert },
              selection: { anchor: sel.from + selected.length + 3, head: sel.from + selected.length + 6 },
            });
          } else {
            const insert = "[](url)";
            view.dispatch({
              changes: { from: sel.from, to: sel.to, insert },
              selection: { anchor: sel.from + 1 },
            });
          }
          return true;
        },
      },
    ]);

    // Ctrl+Click on wikilinks to navigate
    const clickHandler = EditorView.domEventHandlers({
      click: (event, view) => {
        if (!(event.ctrlKey || event.metaKey)) return false;
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
        if (pos === null) return false;
        const line = view.state.doc.lineAt(pos);
        const text = line.text;
        const offset = pos - line.from;
        // Find all [[...]] in the line and check if click is inside one
        const re = /\[\[([^\]]+)\]\]/g;
        let match;
        while ((match = re.exec(text)) !== null) {
          if (offset >= match.index && offset <= match.index + match[0].length) {
            const inner = match[1];
            const target = inner.includes("|") ? inner.split("|")[0] : inner;
            if (onNavigate) onNavigate(target.trim());
            event.preventDefault();
            return true;
          }
        }
        return false;
      },
    });

    // Upload an image file and insert embed link at cursor
    const uploadAndInsert = (file: File, view: EditorView) => {
      const ext = file.name.includes(".")
        ? file.name.slice(file.name.lastIndexOf("."))
        : `.${file.type.split("/")[1]?.replace("jpeg", "jpg") || "png"}`;
      const baseName = file.name.includes(".")
        ? file.name.slice(0, file.name.lastIndexOf("."))
        : `Pasted image ${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}`;
      const filename = `${baseName}${ext}`;
      file.arrayBuffer().then((buf) => {
        fetch(`/api/vault/upload?filename=${encodeURIComponent(filename)}`, {
          method: "POST",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: buf,
          credentials: "include",
        })
          .then((r) => r.json())
          .then((data) => {
            if (data.filename) {
              const insert = `![[${data.filename}]]`;
              const pos = view.state.selection.main.head;
              view.dispatch({
                changes: { from: pos, insert },
                selection: { anchor: pos + insert.length },
              });
            }
          });
      });
    };

    // Paste images from clipboard + drag-and-drop images
    const pasteHandler = EditorView.domEventHandlers({
      paste: (event, view) => {
        const items = event.clipboardData?.items;
        if (!items) return false;
        for (const item of items) {
          if (item.type.startsWith("image/")) {
            event.preventDefault();
            const file = item.getAsFile();
            if (!file) return true;
            uploadAndInsert(file, view);
            return true;
          }
        }
        return false;
      },
      drop: (event, view) => {
        const files = event.dataTransfer?.files;
        if (!files || files.length === 0) return false;
        const imageFiles = [...files].filter((f) => f.type.startsWith("image/"));
        if (imageFiles.length === 0) return false;
        event.preventDefault();
        // Move cursor to drop position
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
        if (pos !== null) {
          view.dispatch({ selection: { anchor: pos } });
        }
        for (const file of imageFiles) {
          uploadAndInsert(file, view);
        }
        return true;
      },
    });

    // Hover preview state (managed via DOM listeners after view creation)
    const hoverMd = createMarkdownRenderer();
    let hoverEl: HTMLDivElement | null = null;
    let hoverTimer: ReturnType<typeof setTimeout> | null = null;
    let hoverTarget = "";
    const removeHover = () => {
      if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
      if (hoverEl) { hoverEl.remove(); hoverEl = null; }
      hoverTarget = "";
    };

    // Place cursor after frontmatter so the Properties widget shows immediately
    const fm = parseFrontmatterRange({ toString: () => content });
    const initialCursor = fm ? Math.min(fm.to + 1, content.length) : 0;

    const state = EditorState.create({
      doc: content,
      selection: { anchor: initialCursor },
      extensions: [
        lineNumbersComp.current.of(showLineNumbers ? lineNumbers() : []),
        highlightActiveLine(),
        bracketMatching(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, ...closeBracketsKeymap, ...foldKeymap, indentWithTab]),
        closeBrackets(),
        markdownAutoPair,
        search(),
        codeFolding(),
        markdownHeadingFold,
        foldGutter({
          markerDOM(open) {
            const span = document.createElement("span");
            span.textContent = open ? "▾" : "▸";
            span.style.cssText = "color: #555; cursor: pointer; font-size: 11px; user-select: none; opacity: 0.6; transition: opacity 0.15s;";
            span.addEventListener("mouseenter", () => { span.style.opacity = "1"; span.style.color = "#aaa"; });
            span.addEventListener("mouseleave", () => { span.style.opacity = "0.6"; span.style.color = "#555"; });
            return span;
          },
        }),
        saveKeymap,
        markdown(),
        oneDarkTheme,
        syntaxHighlighting(obsidianHighlight, { fallback: false }),
        syntaxHighlighting(classHighlighter),
        headingPlugin,
        frontmatterField,
        imagePreviewField,
        checkboxField,
        livePreviewWidgetsField,
        inlineMarkerField,
        livePreviewTheme,
        fontSizeComp.current.of(EditorView.theme({ "&": { fontSize: `${fontSize}px` } })),
        tabSizeComp.current.of(EditorState.tabSize.of(tabSize)),
        indentUnitComp.current.of(indentUnit.of(" ".repeat(tabSize))),
        vimComp.current.of(vimMode ? vim() : []),
        EditorView.lineWrapping,
        spellCheckComp.current.of(EditorView.contentAttributes.of({ spellcheck: spellCheck ? "true" : "false" })),
        focusModeComp.current.of(focusMode ? EditorView.theme({
          ".cm-line:not(.cm-activeLine)": { opacity: "0.3", transition: "opacity 0.15s" },
          ".cm-line.cm-activeLine": { opacity: "1" },
        }) : []),
        typewriterComp.current.of(typewriterMode ? EditorView.updateListener.of((update) => {
          if (update.docChanged || update.selectionSet) {
            const head = update.state.selection.main.head;
            update.view.requestMeasure({
              read() { return update.view.coordsAtPos(head); },
              write(coords) {
                if (!coords) return;
                const rect = update.view.dom.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                const diff = coords.top - midY;
                if (Math.abs(diff) > 10) {
                  update.view.scrollDOM.scrollBy({ top: diff, behavior: "smooth" });
                }
              },
            });
          }
        }) : []),
        autocompletion({
          override: [wikilinkCompletion, tagCompletion, slashCompletion],
          activateOnTyping: true,
        }),
        clickHandler,
        pasteHandler,
        // Auto-save on change with debounce, and track cursor position
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onDirty?.();
            if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
            autoSaveTimer.current = setTimeout(() => {
              onSave(update.state.doc.toString());
            }, 1500);
          }
          if (onCursorChange && (update.selectionSet || update.docChanged)) {
            const sel = update.state.selection.main;
            const pos = sel.head;
            const line = update.state.doc.lineAt(pos);
            const selectedChars = Math.abs(sel.to - sel.from);
            onCursorChange({ line: line.number, col: pos - line.from + 1, selectedChars });
          }
        }),
      ],
    });

    viewRef.current = new EditorView({
      state,
      parent: containerRef.current,
    });

    // Expose scroll-to-heading function for outline sidebar
    if (scrollToHeadingRef) {
      scrollToHeadingRef.current = (heading: string, level: number) => {
        const view = viewRef.current;
        if (!view) return;
        const doc = view.state.doc;
        const re = new RegExp(`^#{${level}}\\s+${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`);
        for (let i = 1; i <= doc.lines; i++) {
          const line = doc.line(i);
          if (re.test(line.text)) {
            view.dispatch({
              effects: EditorView.scrollIntoView(line.from, { y: "start" }),
            });
            return;
          }
        }
      };
    }

    // Attach hover preview listeners directly on the content DOM
    const contentDOM = viewRef.current.contentDOM;
    const handleMouseMove = (e: MouseEvent) => {
      const view = viewRef.current;
      if (!view) return;
      const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
      if (pos === null) { removeHover(); return; }
      const line = view.state.doc.lineAt(pos);
      const offset = pos - line.from;
      const text = line.text;
      const re = /\[\[([^\]]+)\]\]/g;
      let match;
      let found = "";
      while ((match = re.exec(text)) !== null) {
        if (offset >= match.index && offset <= match.index + match[0].length) {
          const inner = match[1];
          found = inner.includes("|") ? inner.split("|")[0] : inner;
          break;
        }
      }
      if (!found) { removeHover(); return; }
      if (found === hoverTarget) return;
      removeHover();
      hoverTarget = found;

      const mouseX = e.clientX;
      const mouseY = e.clientY;
      hoverTimer = setTimeout(() => {
        const target = hoverTarget;
        fetch(`/api/vault/resolve?target=${encodeURIComponent(target)}&from=${encodeURIComponent(filePath)}`, { credentials: "include" })
          .then((r) => r.json())
          .then((data) => {
            if (!data.resolved || hoverTarget !== target) return;
            return fetch(`/api/vault/file?path=${encodeURIComponent(data.resolved)}`, { credentials: "include" })
              .then((r) => r.json())
              .then((fileData) => {
                if (fileData.error || hoverTarget !== target || !view.dom) return;
                let previewContent = fileData.content;
                const fmMatch = /^---[\t ]*\r?\n[\s\S]*?\n---[\t ]*(?:\r?\n|$)/.exec(previewContent);
                if (fmMatch) previewContent = previewContent.slice(fmMatch[0].length);
                if (previewContent.length > 800) previewContent = previewContent.slice(0, 800) + "\n\n...";

                hoverEl = document.createElement("div");
                hoverEl.className = "hover-preview";
                hoverEl.innerHTML = hoverMd.render(previewContent);
                const editorDom = view.dom;
                editorDom.style.position = "relative";
                const editorRect = editorDom.getBoundingClientRect();
                hoverEl.style.position = "absolute";
                hoverEl.style.left = `${mouseX - editorRect.left}px`;
                hoverEl.style.top = `${mouseY - editorRect.top + 20}px`;
                hoverEl.style.zIndex = "100";
                editorDom.appendChild(hoverEl);

                const previewRect = hoverEl.getBoundingClientRect();
                if (previewRect.bottom > window.innerHeight - 20) {
                  hoverEl.style.top = `${mouseY - editorRect.top - previewRect.height - 10}px`;
                }
              });
          })
          .catch(() => {});
      }, 300);
    };
    const handleMouseLeave = () => removeHover();
    contentDOM.addEventListener("mousemove", handleMouseMove);
    contentDOM.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      contentDOM.removeEventListener("mousemove", handleMouseMove);
      contentDOM.removeEventListener("mouseleave", handleMouseLeave);
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      removeHover();
      viewRef.current?.destroy();
      viewRef.current = null;
    };
  }, [filePath]); // Only re-create editor when file changes; settings use Compartments

  // Hot-swap settings via Compartments (no editor recreation)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: [
        fontSizeComp.current.reconfigure(EditorView.theme({ "&": { fontSize: `${fontSize}px` } })),
        spellCheckComp.current.reconfigure(EditorView.contentAttributes.of({ spellcheck: spellCheck ? "true" : "false" })),
        lineNumbersComp.current.reconfigure(showLineNumbers ? lineNumbers() : []),
        tabSizeComp.current.reconfigure(EditorState.tabSize.of(tabSize)),
        indentUnitComp.current.reconfigure(indentUnit.of(" ".repeat(tabSize))),
        focusModeComp.current.reconfigure(focusMode ? EditorView.theme({
          ".cm-line:not(.cm-activeLine)": { opacity: "0.3", transition: "opacity 0.15s" },
          ".cm-line.cm-activeLine": { opacity: "1" },
        }) : []),
        vimComp.current.reconfigure(vimMode ? vim() : []),
        typewriterComp.current.reconfigure(typewriterMode ? EditorView.updateListener.of((update) => {
          if (update.docChanged || update.selectionSet) {
            const head = update.state.selection.main.head;
            update.view.requestMeasure({
              read() { return update.view.coordsAtPos(head); },
              write(coords) {
                if (!coords) return;
                const rect = update.view.dom.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                const diff = coords.top - midY;
                if (Math.abs(diff) > 10) {
                  update.view.scrollDOM.scrollBy({ top: diff, behavior: "smooth" });
                }
              },
            });
          }
        }) : []),
      ],
    });
  }, [fontSize, spellCheck, showLineNumbers, tabSize, typewriterMode, focusMode, vimMode]);

  // Update editor content when it arrives asynchronously (e.g. workspace restore)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const currentDoc = view.state.doc.toString();
    if (content && content !== currentDoc) {
      const fm = parseFrontmatterRange({ toString: () => content });
      const cursorPos = fm ? Math.min(fm.to + 1, content.length) : 0;
      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: content },
        selection: { anchor: cursorPos },
      });
    }
  }, [content]);

  return (
    <div
      ref={containerRef}
      style={{ height: "100%", overflow: "auto" }}
    />
  );
}
