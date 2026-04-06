// Embedded demo vault for GitHub Pages deployment (no server needed)
// This provides a rich showcase of Websidian features

export interface DemoFile {
  path: string;
  content: string;
  mtime: number;
}

const now = Date.now();
const hour = 3600000;

export const DEMO_VAULT_NAME = "Websidian Demo";

export const DEMO_FILES: DemoFile[] = [
  {
    path: "Welcome.md",
    content: `---
aliases: [Home, Start Here]
tags: [websidian, demo]
cssclasses: []
---

# Welcome to Websidian

This is a **live demo** of [Websidian](https://github.com/nullswan/websidian) — a high-fidelity, web-native Obsidian client running entirely in your browser.

> [!tip] No server needed
> This demo vault runs client-side with an embedded vault. To use your own vault, run \`npx websidian /path/to/your/vault\`.

## What you can do here

- **Navigate** — Click [[Features Overview]] or any [[wikilink]] to explore
- **Edit** — Switch to editor mode (pen icon) and start typing
- **Search** — Press \`Ctrl+Shift+F\` to search across all notes
- **Graph** — Click the graph icon in the ribbon to see connections
- **Command Palette** — Press \`Ctrl+Shift+P\` for all commands

## Quick Links

- [[Features Overview]] — See what Websidian supports
- [[Markdown Showcase]] — Rich markdown rendering demo
- [[Getting Started]] — How to run with your own vault
- [[Architecture]] — Technical details
- [[Learn Markdown]] — Interactive markdown tutorial
- [[Daily Notes/2026-04-06]] — Today's daily note

## Project Stats

| Metric | Value |
|--------|-------|
| Features | 200+ |
| Obsidian parity | ~90% |
| Editor | CodeMirror 6 |
| Framework | React + Vite |

---

*Built with love for the Obsidian community.*
`,
    mtime: now,
  },
  {
    path: "Features Overview.md",
    content: `---
tags: [websidian, features]
---

# Features Overview

Websidian implements 200+ features for Obsidian parity. Here's a categorized breakdown:

## Editor (Live Preview)

- [x] Sized headings with hidden \`#\` markers
- [x] Bold/italic/strikethrough marker hiding
- [x] Wikilink bracket hiding (\`[[\` and \`]]\`)
- [x] Inline image preview below source line
- [x] Interactive checkboxes
- [x] Bullet dot rendering
- [x] Blockquote styling with purple left border
- [x] Code block syntax highlighting
- [x] LaTeX math rendering ($E = mc^2$)
- [x] Frontmatter properties widget
- [x] Wikilink autocomplete
- [x] Tag autocomplete
- [x] Heading fold (Ctrl+Shift+[/])
- [x] Find & replace (Cmd+F)
- [x] Vim keybindings (optional)

## Reader View

- [x] Full markdown rendering with [[wikilinks]]
- [x] Callout blocks (25 types)
- [x] Mermaid diagrams
- [x] KaTeX math
- [x] Code highlighting (12+ languages)
- [x] Footnotes with hover preview
- [x] Table sorting by column click
- [x] Heading fold & anchor links
- [x] Image lightbox on click
- [x] Embedded note transclusion

## Navigation

- [x] File tree with drag-and-drop
- [x] Quick switcher (Ctrl+O)
- [x] Command palette (Ctrl+Shift+P)
- [x] Graph view with filters
- [x] Backlinks panel
- [x] Outgoing links panel
- [x] Breadcrumb navigation
- [x] Back/forward history
- [x] Tab management (pin, drag, close)

## See Also

- [[Markdown Showcase]] for rendering examples
- [[Getting Started]] for setup instructions
`,
    mtime: now - hour,
  },
  {
    path: "Markdown Showcase.md",
    content: `---
tags: [demo, markdown]
---

# Markdown Showcase

This note demonstrates Websidian's markdown rendering capabilities.

## Text Formatting

**Bold text**, *italic text*, ~~strikethrough~~, ==highlighted text==, \`inline code\`, and ***bold italic***.

## Callouts

> [!note] This is a note callout
> Callouts support 25 different types with unique colors and icons.

> [!warning] Warning callout
> Something to be careful about.

> [!tip] Pro tip
> You can collapse callouts by adding \`-\` after the type: \`> [!tip]-\`

> [!example]- Collapsible example
> Click the arrow to expand/collapse this callout.

## Code Blocks

\`\`\`javascript
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

console.log(fibonacci(10)); // 55
\`\`\`

\`\`\`python
def quicksort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quicksort(left) + middle + quicksort(right)
\`\`\`

## Math (KaTeX)

Inline math: $\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$

Display math:

$$
\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}
$$

$$
\\nabla \\times \\mathbf{E} = -\\frac{\\partial \\mathbf{B}}{\\partial t}
$$

## Mermaid Diagrams

\`\`\`mermaid
graph TD
    A[Vault Files] --> B[Parser]
    B --> C[Markdown AST]
    C --> D[Reader View]
    C --> E[Editor View]
    D --> F[Rendered HTML]
    E --> G[CodeMirror 6]
\`\`\`

## Tables

| Language | Typing | Use Case |
|----------|--------|----------|
| TypeScript | Static | Frontend/Backend |
| Python | Dynamic | Data Science |
| Rust | Static | Systems |
| Go | Static | Cloud Services |

## Task Lists

- [x] Create demo vault
- [x] Add markdown examples
- [ ] Add more diagram types
- [ ] Test all callout variants

## Footnotes

Websidian supports footnotes[^1] with hover preview[^2].

[^1]: Footnotes appear at the bottom of the note.
[^2]: Hover over the footnote reference to see a preview popup.

## Blockquotes

> "The best way to predict the future is to invent it."
> — Alan Kay

> [!quote] Nested blockquote
> > This is a nested blockquote inside a callout.

## Links

- Internal: [[Welcome]] | [[Features Overview]]
- External: [Obsidian](https://obsidian.md) | [GitHub](https://github.com)
- Heading: [[#Math (KaTeX)]] | [[#Code Blocks]]

## Tags

This note has tags: #demo #markdown #showcase

---

Back to [[Welcome]]
`,
    mtime: now - 2 * hour,
  },
  {
    path: "Getting Started.md",
    content: `---
tags: [websidian, setup]
---

# Getting Started

## Installation

Run Websidian with your existing Obsidian vault:

\`\`\`bash
npx websidian /path/to/your/vault
\`\`\`

Then open \`http://localhost:5173\` in your browser.

## Requirements

- **Node.js** 18+ (recommended: 20 LTS)
- An existing Obsidian vault directory

## How It Works

\`\`\`mermaid
sequenceDiagram
    participant B as Browser
    participant V as Vite Dev Server
    participant S as Fastify Server
    participant F as File System

    B->>V: Load app (port 5173)
    V->>B: React SPA
    B->>S: GET /api/vault/tree
    S->>F: Read directory
    F->>S: File list
    S->>B: JSON tree
    B->>S: GET /api/vault/file?path=X
    S->>F: Read file
    F->>S: Content
    S->>B: File content
\`\`\`

## Configuration

Websidian reads your vault's \`.obsidian/\` configuration:

| Config | Source | What it does |
|--------|--------|-------------|
| Themes | \`.obsidian/themes/\` | CSS theme loading |
| Snippets | \`.obsidian/snippets/\` | Custom CSS snippets |
| Plugins | \`.obsidian/plugins/\` | Plugin manifest scanning |
| App settings | \`.obsidian/app.json\` | Editor preferences |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| \`Ctrl+O\` | Quick switcher |
| \`Ctrl+Shift+P\` | Command palette |
| \`Ctrl+Shift+F\` | Vault search |
| \`Ctrl+N\` | New note |
| \`Ctrl+,\` | Settings |
| \`Ctrl+\\\` | Toggle left sidebar |
| \`Ctrl+Shift+\\\` | Toggle right sidebar |
| \`Ctrl+Tab\` | Next tab |
| \`Ctrl+Shift+T\` | Undo close tab |
| \`Ctrl+/\` | Keyboard shortcuts help |

> [!info] Demo Mode
> This demo vault runs entirely in your browser. Edits are stored in localStorage and will persist across page reloads.

---

Back to [[Welcome]]
`,
    mtime: now - 3 * hour,
  },
  {
    path: "Architecture.md",
    content: `---
tags: [websidian, technical]
---

# Architecture

## Monorepo Structure

\`\`\`
websidian/
├── packages/
│   ├── vault-core/    # Shared domain models, parser, resolver
│   ├── web/           # React + Vite frontend
│   └── server/        # Fastify backend
├── fixtures/          # Test vault
├── evals/             # Fidelity eval scorecard
└── docs/              # Design documents
\`\`\`

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Editor | CodeMirror 6 with custom extensions |
| Rendering | markdown-it + custom plugins |
| UI Framework | React 18 |
| Build Tool | Vite 6 |
| Backend | Fastify 5 |
| Math | KaTeX |
| Diagrams | Mermaid |
| Syntax | highlight.js |
| Graph | Custom Canvas/SVG |

## Key Design Decisions

### 1. CodeMirror 6 Compartments

We use CM6 compartments for hot-swappable editor settings:

\`\`\`typescript
// Settings can change without recreating the editor
const fontSizeCompartment = new Compartment();
const spellCheckCompartment = new Compartment();

// Update at runtime:
view.dispatch({
  effects: fontSizeCompartment.reconfigure(
    EditorView.theme({ ".cm-content": { fontSize: "16px" } })
  )
});
\`\`\`

### 2. Wikilink Resolution

Links resolve using a vault-wide shortest-path algorithm:

\`\`\`
[[Note]]           → finds Note.md anywhere in vault
[[folder/Note]]    → prioritizes exact path match
[[Note#Heading]]   → resolves to heading anchor
[[Note|Display]]   → shows "Display" text
\`\`\`

### 3. Live Preview

The editor uses CM6 decorations to hide markdown syntax on non-active lines while preserving the source document. This matches Obsidian's "Live Preview" mode.

## Performance

- **Lazy loading**: Notes loaded on demand, not all at startup
- **Virtual scrolling**: Large file trees use windowed rendering
- **Debounced saves**: 1.5s auto-save debounce
- **Web Workers**: Heavy parsing offloaded where possible

---

See also: [[Features Overview]] | [[Getting Started]]
`,
    mtime: now - 4 * hour,
  },
  {
    path: "Daily Notes/2026-04-06.md",
    content: `---
tags: [daily]
---

# 2026-04-06

## Tasks

- [x] Explore the Websidian demo
- [ ] Try editing this note
- [ ] Check out the [[Features Overview]]
- [ ] Open the graph view
- [ ] Test the search function

## Notes

Welcome to today's daily note! In Websidian, daily notes are created automatically with the calendar icon in the ribbon.

### What I learned

- Websidian supports 200+ Obsidian features
- The editor uses [[Architecture#1. CodeMirror 6 Compartments|CodeMirror 6]] for Live Preview
- [[Markdown Showcase|The markdown rendering]] is surprisingly complete

## Ideas

> [!idea] Future explorations
> - Try creating new notes with \`Ctrl+N\`
> - Explore the command palette with \`Ctrl+Shift+P\`
> - Check backlinks in the right sidebar

---

Back to [[Welcome]]
`,
    mtime: now,
  },
  {
    path: "Projects/Websidian Roadmap.md",
    content: `---
tags: [websidian, roadmap, project]
---

# Websidian Roadmap

## Completed Milestones

### M0: Scaffold
- [x] Monorepo setup (pnpm workspaces)
- [x] Vault-core domain models
- [x] Fixture test vault

### M1: Basic Rendering
- [x] Markdown-it pipeline
- [x] Wikilink resolution
- [x] Image serving

### M2: Editor
- [x] CodeMirror 6 integration
- [x] Live Preview mode
- [x] Auto-save

### M3: Navigation
- [x] File tree
- [x] Tabs & panes
- [x] Quick switcher

### M4: Advanced Rendering
- [x] Callouts (25 types)
- [x] KaTeX math
- [x] Mermaid diagrams
- [x] Code highlighting
- [x] Embeds & transclusion

### M5: Graph & Search
- [x] Interactive graph view
- [x] Full-text search
- [x] Backlinks & outgoing links

### M6: Polish
- [x] Themes (light/dark)
- [x] Settings panel
- [x] Keyboard shortcuts
- [x] Mobile responsive

### M7: Plugins
- [x] Plugin manifest scanning
- [x] Browser-safe sandbox runtime

## In Progress

### M8: Sync & Offline
- [ ] PWA offline support
- [ ] Conflict resolution
- [ ] Export to static site

## Future

- [ ] Collaboration (CRDT)
- [ ] Plugin marketplace
- [ ] Mobile app wrapper

---

See also: [[Architecture]] | [[Features Overview]]
`,
    mtime: now - 5 * hour,
  },
  {
    path: "Projects/Note Taking Tips.md",
    content: `---
tags: [tips, productivity]
---

# Note Taking Tips

## The Zettelkasten Method

The Zettelkasten (German for "slip box") method emphasizes:

1. **Atomic notes** — Each note captures one idea
2. **Links over folders** — Connect ideas with [[wikilinks]]
3. **Your own words** — Rewrite concepts, don't just copy
4. **Emergence** — Let structure emerge from connections

> [!quote] Sönke Ahrens
> "The slip-box is designed to present you with ideas you have already forgotten, allowing your brain to focus on thinking instead of remembering."

## Tips for Websidian

- Use **tags** for broad categories: #project #idea #reference
- Use **links** for specific connections: [[Architecture]]
- Use **daily notes** for fleeting thoughts: [[Daily Notes/2026-04-06]]
- Use **templates** for recurring structures
- Use the **graph view** to discover unexpected connections

## Keyboard Shortcuts for Speed

| Action | Shortcut |
|--------|----------|
| Quick switch | \`Ctrl+O\` |
| New note | \`Ctrl+N\` |
| Bold | \`Ctrl+B\` |
| Italic | \`Ctrl+I\` |
| Link | \`Ctrl+K\` |
| Checkbox toggle | \`Ctrl+Enter\` |

---

Back to [[Welcome]]
`,
    mtime: now - 6 * hour,
  },
  {
    path: "Learn Markdown.md",
    content: `---
tags: [websidian, demo, markdown]
aliases: [Markdown Tutorial, Markdown Guide]
---

# Learn Markdown

Switch to **editor mode** (click the pen icon above) to edit these examples live!

## Text Formatting

- **Bold text** using \`**double asterisks**\`
- *Italic text* using \`*single asterisks*\`
- ~~Strikethrough~~ using \`~~tildes~~\`
- ==Highlighted text== using \`==double equals==\`
- \`Inline code\` using backticks

## Headings

Headings use \`#\` symbols. Try \`Ctrl+1\` through \`Ctrl+6\` in the editor to change heading level!

## Links

- **Wikilinks**: [[Welcome]] — click to navigate
- **External links**: [GitHub](https://github.com)
- **Heading links**: [[Features Overview#Editor]]

## Lists

Unordered:
- Item one
- Item two
  - Nested item

Ordered:
1. First
2. Second
3. Third

## Task Lists

- [x] Learn markdown basics
- [x] Try the editor
- [ ] Explore the graph view
- [ ] Use the command palette (\`Ctrl+Shift+P\`)

## Blockquotes & Callouts

> A regular blockquote looks like this.
> — Someone wise

> [!tip] Callout blocks
> Use \`> [!type]\` for callouts. Types: tip, info, warning, danger, note, abstract, todo, example, quote

> [!warning] Try editing me!
> Switch to editor mode and modify this callout.

## Code Blocks

\`\`\`javascript
function greet(name) {
  return \`Hello, \${name}!\`;
}
\`\`\`

## Tables

| Feature | Status | Notes |
|---------|--------|-------|
| Bold    | ✅     | Ctrl+B |
| Links   | ✅     | Ctrl+K |
| Tables  | ✅     | Auto-format |

## Math (LaTeX)

Inline: $E = mc^2$

Display:
$$\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$$

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| \`Ctrl+B\` | Bold |
| \`Ctrl+I\` | Italic |
| \`Ctrl+K\` | Insert link |
| \`Ctrl+1-6\` | Heading level |
| \`Ctrl+Shift+P\` | Command palette |
| \`Ctrl+Shift+F\` | Search vault |
| \`Ctrl+O\` | Quick switcher |

---

Back to [[Welcome]] · See also: [[Features Overview]] · [[Markdown Showcase]]
`,
    mtime: now - 2 * hour,
  },
];

// Build a VaultEntry tree from flat file list
export interface VaultEntry {
  kind: "file" | "folder";
  name: string;
  path: string;
  children: VaultEntry[];
  mtime?: number;
  size?: number;
}

export function buildDemoTree(files: DemoFile[]): VaultEntry[] {
  const root: VaultEntry[] = [];
  const folderMap = new Map<string, VaultEntry>();

  for (const file of files) {
    const parts = file.path.split("/");
    let currentPath = "";
    let currentChildren = root;

    for (let i = 0; i < parts.length - 1; i++) {
      currentPath += (currentPath ? "/" : "") + parts[i];
      let folder = folderMap.get(currentPath);
      if (!folder) {
        folder = { kind: "folder", name: parts[i], path: currentPath, children: [] };
        folderMap.set(currentPath, folder);
        currentChildren.push(folder);
      }
      currentChildren = folder.children;
    }

    currentChildren.push({
      kind: "file",
      name: parts[parts.length - 1],
      path: file.path,
      children: [],
      mtime: file.mtime,
      size: file.content.length,
    });
  }

  return root;
}
