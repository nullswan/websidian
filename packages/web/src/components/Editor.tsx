import { useEffect, useRef } from "react";
import { EditorView, keymap, highlightActiveLine, Decoration, ViewPlugin, DecorationSet } from "@codemirror/view";
import { EditorState, RangeSetBuilder } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { syntaxHighlighting, HighlightStyle, syntaxTree, bracketMatching } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { oneDarkTheme } from "@codemirror/theme-one-dark";
import { autocompletion, closeBrackets, closeBracketsKeymap, CompletionContext, type Completion } from "@codemirror/autocomplete";
import { search, searchKeymap } from "@codemirror/search";

interface EditorProps {
  content: string;
  filePath: string;
  onSave: (content: string) => void;
  onNavigate?: (target: string) => void;
  onCursorChange?: (info: { line: number; col: number; selectedChars: number }) => void;
}

// Obsidian-like highlight style for markdown Live Preview
const obsidianHighlight = HighlightStyle.define([
  { tag: tags.heading1, fontSize: "1.8em", fontWeight: "700", color: "#ddd" },
  { tag: tags.heading2, fontSize: "1.5em", fontWeight: "600", color: "#ddd" },
  { tag: tags.heading3, fontSize: "1.25em", fontWeight: "600", color: "#ddd" },
  { tag: tags.heading4, fontSize: "1.1em", fontWeight: "600", color: "#ddd" },
  { tag: tags.heading5, fontSize: "1.05em", fontWeight: "600", color: "#ccc" },
  { tag: tags.heading6, fontSize: "1em", fontWeight: "600", color: "#bbb" },
  { tag: tags.strong, fontWeight: "bold", color: "#e0e0e0" },
  { tag: tags.emphasis, fontStyle: "italic", color: "#e0e0e0" },
  { tag: tags.strikethrough, textDecoration: "line-through", color: "#888" },
  { tag: tags.link, color: "#7f6df2", textDecoration: "underline" },
  { tag: tags.url, color: "#7f6df2", opacity: "0.7" },
  { tag: tags.monospace, fontFamily: "monospace", backgroundColor: "rgba(255,255,255,0.06)", padding: "1px 4px", borderRadius: "3px" },
  { tag: tags.processingInstruction, color: "#7f6df2" }, // tags (#tag)
  { tag: tags.meta, color: "#888" }, // frontmatter delimiters
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
    update(update: { docChanged: boolean; viewportChanged: boolean; view: EditorView }) {
      if (update.docChanged || update.viewportChanged) {
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

// Custom theme overrides for Live Preview feel — using CSS classes for heading colors
// because HighlightStyle can't override oneDark's heading color reliably
const livePreviewTheme = EditorView.theme({
  "&": {
    fontSize: "16px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  ".cm-content": {
    padding: "20px 40px",
    maxWidth: "800px",
    caretColor: "#7f6df2",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  ".cm-scroller": {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  ".cm-line": {
    lineHeight: "1.6",
  },
  ".cm-heading-line": {
    paddingTop: "8px",
  },
  ".cm-heading-1": { paddingBottom: "4px", borderBottom: "1px solid #333" },
  ".cm-heading-2": { paddingBottom: "2px" },
  ".cm-activeLine": {
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  ".cm-gutters": {
    display: "none",
  },
  ".cm-cursor": {
    borderLeftColor: "#7f6df2",
    borderLeftWidth: "2px",
  },
  // Horizontal rule styling
  ".cm-line:has(.tok-processingInstruction)": {
    opacity: "0.6",
  },
});

// Wikilink autocomplete: triggers after [[
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

export function Editor({ content, filePath, onSave, onNavigate, onCursorChange }: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    const state = EditorState.create({
      doc: content,
      extensions: [
        highlightActiveLine(),
        bracketMatching(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, ...closeBracketsKeymap, indentWithTab]),
        closeBrackets(),
        search(),
        saveKeymap,
        markdown(),
        oneDarkTheme,
        syntaxHighlighting(obsidianHighlight, { fallback: false }),
        headingPlugin,
        livePreviewTheme,
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({ spellcheck: "true" }),
        autocompletion({
          override: [wikilinkCompletion],
          activateOnTyping: true,
        }),
        clickHandler,
        // Auto-save on change with debounce, and track cursor position
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
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

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      viewRef.current?.destroy();
      viewRef.current = null;
    };
  }, [filePath]); // Re-create editor when file changes

  // Update editor content when it arrives asynchronously (e.g. workspace restore)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const currentDoc = view.state.doc.toString();
    if (content && content !== currentDoc) {
      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: content },
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
