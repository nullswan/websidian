// Demo mode fetch interceptor — serves embedded vault when no server is available
import { DEMO_FILES, DEMO_VAULT_NAME, buildDemoTree, type DemoFile } from "./demoVault.js";

let demoFiles: DemoFile[] = [...DEMO_FILES];
let activated = false;

// Load any edits from localStorage
function loadEdits() {
  try {
    const edits = JSON.parse(localStorage.getItem("websidian-demo-edits") || "{}") as Record<string, string>;
    for (const [path, content] of Object.entries(edits)) {
      const existing = demoFiles.find((f) => f.path === path);
      if (existing) {
        existing.content = content;
        existing.mtime = Date.now();
      } else {
        demoFiles.push({ path, content, mtime: Date.now() });
      }
    }
  } catch { /* ignore */ }
}

function saveEdit(path: string, content: string) {
  try {
    const edits = JSON.parse(localStorage.getItem("websidian-demo-edits") || "{}") as Record<string, string>;
    edits[path] = content;
    localStorage.setItem("websidian-demo-edits", JSON.stringify(edits));
  } catch { /* ignore */ }
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function textResponse(text: string, status = 200): Response {
  return new Response(text, { status, headers: { "Content-Type": "text/plain" } });
}

function getParam(url: URL, key: string): string {
  return url.searchParams.get(key) || "";
}

// Extract wikilinks from markdown content
function extractWikilinks(content: string): string[] {
  const links: string[] = [];
  const re = /\[\[([^\]|#]+)(?:#[^\]|]*)?\|?[^\]]*\]\]/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    links.push(m[1].trim());
  }
  return links;
}

// Resolve a wikilink name to a file path
function resolveLink(name: string): string | null {
  // Exact match
  const exact = demoFiles.find((f) => f.path === name || f.path === name + ".md");
  if (exact) return exact.path;
  // Basename match
  const base = name.split("/").pop() || name;
  const match = demoFiles.find((f) => {
    const fname = f.path.replace(/\.md$/, "").split("/").pop();
    return fname === base;
  });
  return match?.path ?? null;
}

// Extract tags from content
function extractTags(content: string): string[] {
  const tags: string[] = [];
  // Frontmatter tags
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (fmMatch) {
    const tagLine = fmMatch[1].match(/tags:\s*\[([^\]]*)\]/);
    if (tagLine) {
      tags.push(...tagLine[1].split(",").map((t) => t.trim()).filter(Boolean));
    }
  }
  // Inline tags
  const inlineRe = /(?:^|\s)#([a-zA-Z][\w/-]*)/g;
  let m;
  while ((m = inlineRe.exec(content)) !== null) {
    if (!tags.includes(m[1])) tags.push(m[1]);
  }
  return tags;
}

function handleApiCall(url: URL, method: string, body?: string): Response | null {
  const path = url.pathname;

  // Health check
  if (path === "/api/health") {
    return jsonResponse({ status: "ok", demo: true });
  }

  // Auth
  if (path === "/api/auth/me") {
    return jsonResponse({ user: "demo", name: "Demo User" });
  }

  // Vault tree
  if (path === "/api/vault/tree") {
    return jsonResponse({ tree: buildDemoTree(demoFiles), name: DEMO_VAULT_NAME });
  }

  // Vault name / config
  if (path === "/api/vault/config") {
    return jsonResponse({ name: DEMO_VAULT_NAME });
  }

  // Read file
  if (path === "/api/vault/file" && method === "GET") {
    const filePath = getParam(url, "path");
    const file = demoFiles.find((f) => f.path === filePath);
    if (file) {
      return jsonResponse({ path: file.path, content: file.content, created: file.mtime, modified: file.mtime, size: file.content.length });
    }
    return jsonResponse({ error: "Not found" }, 404);
  }

  // Write file
  if (path === "/api/vault/file" && (method === "PUT" || method === "POST")) {
    try {
      const data = JSON.parse(body || "{}");
      const filePath = data.path as string;
      const content = data.content as string;
      if (filePath && content !== undefined) {
        const existing = demoFiles.find((f) => f.path === filePath);
        if (existing) {
          existing.content = content;
          existing.mtime = Date.now();
        } else {
          demoFiles.push({ path: filePath, content, mtime: Date.now() });
        }
        saveEdit(filePath, content);
        return jsonResponse({ ok: true });
      }
    } catch { /* ignore */ }
    return jsonResponse({ error: "Bad request" }, 400);
  }

  // Delete file
  if (path === "/api/vault/file" && method === "DELETE") {
    try {
      const data = JSON.parse(body || "{}");
      const filePath = data.path as string;
      demoFiles = demoFiles.filter((f) => f.path !== filePath);
      return jsonResponse({ ok: true });
    } catch { /* ignore */ }
    return jsonResponse({ error: "Bad request" }, 400);
  }

  // Rename
  if (path === "/api/vault/rename") {
    try {
      const data = JSON.parse(body || "{}");
      const oldPath = data.oldPath as string;
      const newPath = data.newPath as string;
      const file = demoFiles.find((f) => f.path === oldPath);
      if (file) {
        file.path = newPath;
        return jsonResponse({ ok: true });
      }
    } catch { /* ignore */ }
    return jsonResponse({ error: "Not found" }, 404);
  }

  // Note (parsed note with metadata)
  if (path === "/api/vault/note") {
    const filePath = getParam(url, "path");
    const file = demoFiles.find((f) => f.path === filePath);
    if (file) {
      const tags = extractTags(file.content);
      const wikilinks = extractWikilinks(file.content);
      const words = file.content.split(/\s+/).filter(Boolean).length;
      return jsonResponse({
        path: file.path,
        content: file.content,
        mtime: file.mtime,
        tags,
        links: wikilinks,
        wordCount: words,
      });
    }
    return jsonResponse({ error: "Not found" }, 404);
  }

  // Backlinks
  if (path === "/api/vault/backlinks") {
    const filePath = getParam(url, "path");
    const baseName = filePath.replace(/\.md$/, "").split("/").pop() || "";
    const backlinks: Array<{ path: string; context: string }> = [];
    for (const file of demoFiles) {
      if (file.path === filePath) continue;
      const links = extractWikilinks(file.content);
      for (const link of links) {
        const resolved = resolveLink(link);
        if (resolved === filePath || link === baseName) {
          // Find context line
          const lines = file.content.split("\n");
          const contextLine = lines.find((l) => l.includes(`[[${link}`)) || "";
          backlinks.push({ path: file.path, context: contextLine.trim() });
        }
      }
    }
    return jsonResponse({ backlinks, unlinkedMentions: [] });
  }

  // Search
  if (path === "/api/vault/search") {
    const query = getParam(url, "q").toLowerCase();
    const regex = getParam(url, "regex") === "true";
    const caseSensitive = getParam(url, "caseSensitive") === "true";
    const results: Array<{ path: string; matches: Array<{ line: number; text: string }> }> = [];

    let searchRe: RegExp | null = null;
    if (regex) {
      try {
        searchRe = new RegExp(query, caseSensitive ? "g" : "gi");
      } catch { /* invalid regex, fall through to string search */ }
    }

    for (const file of demoFiles) {
      const lines = file.content.split("\n");
      const matches: Array<{ line: number; text: string }> = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const haystack = caseSensitive ? line : line.toLowerCase();
        if (searchRe) {
          searchRe.lastIndex = 0;
          if (searchRe.test(line)) {
            matches.push({ line: i + 1, text: line });
          }
        } else if (haystack.includes(query)) {
          matches.push({ line: i + 1, text: line });
        }
      }
      if (matches.length > 0) {
        results.push({ path: file.path, matches });
      }
    }
    return jsonResponse({ results });
  }

  // Graph
  if (path === "/api/vault/graph") {
    const nodes = demoFiles
      .filter((f) => f.path.endsWith(".md"))
      .map((f) => ({
        id: f.path,
        name: f.path.replace(/\.md$/, "").split("/").pop(),
        path: f.path,
      }));
    const edges: Array<{ source: string; target: string }> = [];
    for (const file of demoFiles) {
      const links = extractWikilinks(file.content);
      for (const link of links) {
        const resolved = resolveLink(link);
        if (resolved && resolved !== file.path) {
          edges.push({ source: file.path, target: resolved });
        }
      }
    }
    return jsonResponse({ nodes, edges });
  }

  // Git status (empty in demo)
  if (path === "/api/vault/git-status") {
    return jsonResponse({});
  }

  // Trash (empty in demo)
  if (path === "/api/vault/trash") {
    return jsonResponse([]);
  }

  // Search-replace
  if (path === "/api/vault/search-replace") {
    try {
      const data = JSON.parse(body || "{}");
      const search = data.search as string;
      const replace = data.replace as string;
      let count = 0;
      for (const file of demoFiles) {
        if (file.content.includes(search)) {
          file.content = file.content.split(search).join(replace);
          count++;
          saveEdit(file.path, file.content);
        }
      }
      return jsonResponse({ ok: true, filesChanged: count });
    } catch { /* ignore */ }
    return jsonResponse({ error: "Bad request" }, 400);
  }

  // Raw file (for images etc — return empty in demo)
  if (path === "/api/vault/raw") {
    return new Response("", { status: 404 });
  }

  // Plugin source (not available in demo)
  if (path === "/api/vault/plugin-source") {
    return jsonResponse({ error: "Not available in demo" }, 404);
  }

  // Tags
  if (path === "/api/vault/tags") {
    const tagCounts: Record<string, number> = {};
    for (const file of demoFiles) {
      for (const tag of extractTags(file.content)) {
        tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
      }
    }
    const tags = Object.entries(tagCounts).map(([tag, count]) => ({ name: tag, count }));
    return jsonResponse({ tags });
  }

  // Stats
  if (path === "/api/vault/stats") {
    const totalNotes = demoFiles.filter((f) => f.path.endsWith(".md")).length;
    const totalWords = demoFiles.reduce((sum, f) => sum + f.content.split(/\s+/).filter(Boolean).length, 0);
    return jsonResponse({ totalNotes, totalWords });
  }

  // Snippets
  if (path === "/api/vault/snippets") {
    return jsonResponse({ snippets: [] });
  }

  // Catch-all for any unhandled /api/ routes — return empty JSON to prevent HTML 404 parse errors
  if (path.startsWith("/api/")) {
    return jsonResponse({});
  }

  return null;
}

export function activateDemoMode() {
  if (activated) return;
  activated = true;
  loadEdits();

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let urlStr: string;
    if (input instanceof Request) {
      urlStr = input.url;
    } else if (input instanceof URL) {
      urlStr = input.toString();
    } else {
      urlStr = input;
    }

    // Only intercept /api/ calls
    if (urlStr.startsWith("/api/") || urlStr.includes("/api/")) {
      const url = new URL(urlStr, window.location.origin);
      const method = init?.method?.toUpperCase() || "GET";
      let body: string | undefined;
      if (init?.body) {
        body = typeof init.body === "string" ? init.body : await new Response(init.body).text();
      }
      const response = handleApiCall(url, method, body);
      if (response) return response;
    }

    return originalFetch(input, init);
  };
}

export function isDemoMode(): boolean {
  return activated;
}
