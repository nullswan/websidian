import type { FastifyInstance } from "fastify";
import { readFile, writeFile, mkdir, readdir, unlink, rename, stat } from "node:fs/promises";
import { join, dirname } from "node:path";
import {
  loadVaultConfig,
  scanVault,
  flattenFiles,
  indexVault,
  parseNote,
  resolveLink,
} from "@obsidian-web/vault-core";

export async function vaultRoutes(app: FastifyInstance) {
  const vaultRoot: string = (app as any).vaultRoot;

  // GET /api/vault/config — vault metadata
  app.get("/config", async () => {
    return loadVaultConfig(vaultRoot);
  });

  // GET /api/vault/tree — full file tree
  app.get("/tree", async () => {
    const tree = await scanVault(vaultRoot);
    return { tree };
  });

  // GET /api/vault/files — flat file list
  app.get("/files", async () => {
    const tree = await scanVault(vaultRoot);
    const files = flattenFiles(tree);
    return { files };
  });

  // GET /api/vault/file?path=... — read a file's content
  app.get<{ Querystring: { path: string } }>(
    "/file",
    async (request, reply) => {
      const filePath = request.query.path;
      if (!filePath) {
        return reply.status(400).send({ error: "path query param required" });
      }

      // Prevent path traversal
      if (filePath.includes("..")) {
        return reply.status(400).send({ error: "invalid path" });
      }

      try {
        const fullPath = join(vaultRoot, filePath);
        const [content, fileStat] = await Promise.all([
          readFile(fullPath, "utf-8"),
          stat(fullPath),
        ]);
        return {
          path: filePath,
          content,
          created: fileStat.birthtime.toISOString(),
          modified: fileStat.mtime.toISOString(),
          size: fileStat.size,
        };
      } catch {
        return reply.status(404).send({ error: "file not found" });
      }
    },
  );

  // GET /api/vault/raw?path=... — serve raw file with correct MIME type (for images, etc.)
  app.get<{ Querystring: { path: string } }>(
    "/raw",
    async (request, reply) => {
      const filePath = request.query.path;
      if (!filePath) {
        return reply.status(400).send({ error: "path query param required" });
      }
      if (filePath.includes("..")) {
        return reply.status(400).send({ error: "invalid path" });
      }

      const ext = filePath.split(".").pop()?.toLowerCase() || "";
      const mimeTypes: Record<string, string> = {
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        gif: "image/gif",
        svg: "image/svg+xml",
        webp: "image/webp",
        bmp: "image/bmp",
        pdf: "application/pdf",
        mp3: "audio/mpeg",
        mp4: "video/mp4",
        wav: "audio/wav",
      };
      const contentType = mimeTypes[ext] || "application/octet-stream";

      try {
        const data = await readFile(join(vaultRoot, filePath));
        return reply.type(contentType).send(data);
      } catch {
        return reply.status(404).send({ error: "file not found" });
      }
    },
  );

  // PUT /api/vault/file — write/update a file
  app.put<{ Body: { path: string; content: string } }>(
    "/file",
    async (request, reply) => {
      const { path: filePath, content } = request.body;
      if (!filePath || content === undefined) {
        return reply
          .status(400)
          .send({ error: "path and content required in body" });
      }

      if (filePath.includes("..")) {
        return reply.status(400).send({ error: "invalid path" });
      }

      const fullPath = join(vaultRoot, filePath);
      await mkdir(dirname(fullPath), { recursive: true });
      await writeFile(fullPath, content, "utf-8");
      return { path: filePath, written: true };
    },
  );

  // DELETE /api/vault/file?path=... — delete a file
  app.delete<{ Querystring: { path: string } }>(
    "/file",
    async (request, reply) => {
      const filePath = request.query.path;
      if (!filePath) {
        return reply.status(400).send({ error: "path query param required" });
      }
      if (filePath.includes("..")) {
        return reply.status(400).send({ error: "invalid path" });
      }

      try {
        await unlink(join(vaultRoot, filePath));
        return { path: filePath, deleted: true };
      } catch {
        return reply.status(404).send({ error: "file not found" });
      }
    },
  );

  // POST /api/vault/rename — rename/move a file (with link auto-update)
  app.post<{ Body: { from: string; to: string; updateLinks?: boolean } }>(
    "/rename",
    async (request, reply) => {
      const { from, to, updateLinks = true } = request.body ?? {};
      if (!from || !to) {
        return reply.status(400).send({ error: "from and to required in body" });
      }
      if (from.includes("..") || to.includes("..")) {
        return reply.status(400).send({ error: "invalid path" });
      }

      const fromPath = join(vaultRoot, from);
      const toPath = join(vaultRoot, to);
      await mkdir(dirname(toPath), { recursive: true });

      try {
        await rename(fromPath, toPath);
      } catch {
        return reply.status(404).send({ error: "source file not found" });
      }

      // Auto-update wikilinks across the vault
      const updatedFiles: string[] = [];
      if (updateLinks && from.endsWith(".md")) {
        const oldBasename = from.split("/").pop()!.replace(/\.md$/, "");
        const newBasename = to.split("/").pop()!.replace(/\.md$/, "");
        if (oldBasename !== newBasename) {
          const tree = await scanVault(vaultRoot);
          const files = flattenFiles(tree);
          const mdFiles = files.filter((f) => f.extension === "md");

          // Regex matches [[oldBasename]], [[oldBasename|display]], [[oldBasename#heading]]
          // Also matches the full old path without extension
          const oldPathNoExt = from.replace(/\.md$/, "");
          const escOld = oldBasename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const escOldPath = oldPathNoExt.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const linkPattern = new RegExp(
            `\\[\\[(${escOldPath}|${escOld})(#[^\\]|]*)?(?:\\|([^\\]]*?))?\\]\\]`,
            "g",
          );

          for (const file of mdFiles) {
            const filePath = join(vaultRoot, file.path);
            const content = await readFile(filePath, "utf-8");
            const newContent = content.replace(linkPattern, (_match, target, fragment, display) => {
              // Replace target with new basename (or new full path if original used full path)
              const newTarget = target === oldPathNoExt
                ? to.replace(/\.md$/, "")
                : newBasename;
              const parts = [`[[${newTarget}`];
              if (fragment) parts.push(fragment);
              if (display) parts.push(`|${display}`);
              parts.push("]]");
              return parts.join("");
            });
            if (newContent !== content) {
              await writeFile(filePath, newContent, "utf-8");
              updatedFiles.push(file.path);
            }
          }
        }
      }

      return { from, to, renamed: true, updatedFiles };
    },
  );

  // GET /api/vault/note?path=... — parsed note metadata
  app.get<{ Querystring: { path: string } }>(
    "/note",
    async (request, reply) => {
      const filePath = request.query.path;
      if (!filePath) {
        return reply.status(400).send({ error: "path query param required" });
      }

      if (filePath.includes("..")) {
        return reply.status(400).send({ error: "invalid path" });
      }

      try {
        const content = await readFile(join(vaultRoot, filePath), "utf-8");
        const meta = parseNote(filePath, content);
        return meta;
      } catch {
        return reply.status(404).send({ error: "file not found" });
      }
    },
  );

  // GET /api/vault/resolve?target=...&from=... — resolve a wikilink
  app.get<{ Querystring: { target: string; from?: string } }>(
    "/resolve",
    async (request, reply) => {
      const { target, from = "" } = request.query;
      if (!target) {
        return reply
          .status(400)
          .send({ error: "target query param required" });
      }

      const tree = await scanVault(vaultRoot);
      const files = flattenFiles(tree);
      const { index } = await indexVault(vaultRoot, files);
      const resolved = resolveLink(target, from, index);

      return { target, from, resolved };
    },
  );

  // GET /api/vault/backlinks?path=... — find notes that link to this note
  app.get<{ Querystring: { path: string } }>(
    "/backlinks",
    async (request, reply) => {
      const filePath = request.query.path;
      if (!filePath) {
        return reply.status(400).send({ error: "path query param required" });
      }

      const tree = await scanVault(vaultRoot);
      const files = flattenFiles(tree);
      const { notes, index } = await indexVault(vaultRoot, files);

      const backlinks: Array<{ path: string; context: string; lineContext?: string }> = [];

      // Read source file contents lazily (cache per note)
      const contentCache = new Map<string, string[]>();
      const getLines = async (notePath: string): Promise<string[]> => {
        if (contentCache.has(notePath)) return contentCache.get(notePath)!;
        try {
          const raw = await readFile(join(vaultRoot, notePath), "utf-8");
          const lines = raw.split("\n");
          contentCache.set(notePath, lines);
          return lines;
        } catch {
          return [];
        }
      };

      for (const note of notes) {
        if (note.path === filePath) continue;
        for (const link of note.links) {
          const resolved = resolveLink(link.target, note.path, index);
          if (resolved === filePath) {
            const lines = await getLines(note.path);
            const lineText = link.line > 0 && link.line <= lines.length
              ? lines[link.line - 1].trim()
              : undefined;
            backlinks.push({
              path: note.path,
              context: link.display ?? link.target,
              lineContext: lineText,
            });
          }
        }
      }

      // Unlinked mentions: notes containing the current note's title but not linking to it
      const linkedPaths = new Set(backlinks.map((b) => b.path));
      linkedPaths.add(filePath); // exclude self
      const basename = filePath.replace(/\.md$/, "").split("/").pop() ?? "";
      const unlinkedMentions: Array<{ path: string; line: number; lineContext: string }> = [];

      if (basename.length >= 2) {
        const searchLower = basename.toLowerCase();
        for (const note of notes) {
          if (linkedPaths.has(note.path)) continue;
          const lines = await getLines(note.path);
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].toLowerCase().includes(searchLower)) {
              // Skip if the mention is inside a wikilink
              const wikiLinkRe = /\[\[([^\]]*)\]\]/g;
              let inWikilink = false;
              let m;
              while ((m = wikiLinkRe.exec(lines[i])) !== null) {
                if (m[1].toLowerCase().includes(searchLower)) {
                  inWikilink = true;
                  break;
                }
              }
              if (!inWikilink) {
                unlinkedMentions.push({ path: note.path, line: i + 1, lineContext: lines[i].trim() });
              }
            }
          }
        }
      }

      return { path: filePath, backlinks, unlinkedMentions };
    },
  );

  // GET /api/vault/search?q=...&regex=true — full-text search across vault
  app.get<{ Querystring: { q: string; regex?: string; caseSensitive?: string } }>(
    "/search",
    async (request, reply) => {
      const query = request.query.q?.trim();
      if (!query) {
        return reply.status(400).send({ error: "q query param required" });
      }

      const isRegex = request.query.regex === "true";
      const caseSensitive = request.query.caseSensitive === "true";

      let re: RegExp | null = null;
      if (isRegex) {
        try {
          re = new RegExp(query, caseSensitive ? "g" : "gi");
        } catch {
          return reply.status(400).send({ error: "Invalid regex pattern" });
        }
      }

      const tree = await scanVault(vaultRoot);
      const files = flattenFiles(tree);

      const results: Array<{
        path: string;
        matches: Array<{ line: number; text: string }>;
      }> = [];

      for (const file of files) {
        if (file.extension !== "md") continue;
        const content = await readFile(join(vaultRoot, file.path), "utf-8");
        const lines = content.split("\n");
        const matches: Array<{ line: number; text: string }> = [];

        for (let i = 0; i < lines.length; i++) {
          let isMatch = false;
          if (re) {
            re.lastIndex = 0;
            isMatch = re.test(lines[i]);
          } else if (caseSensitive) {
            isMatch = lines[i].includes(query);
          } else {
            isMatch = lines[i].toLowerCase().includes(query.toLowerCase());
          }
          if (isMatch) {
            matches.push({
              line: i + 1,
              text: lines[i].trim().slice(0, 200),
            });
          }
        }

        if (matches.length > 0) {
          results.push({ path: file.path, matches });
        }
      }

      return { query, results };
    },
  );

  // POST /api/vault/search-replace — replace text across vault files
  app.post<{ Body: { query: string; replace: string; regex?: boolean; caseSensitive?: boolean; paths?: string[] } }>(
    "/search-replace",
    async (request, reply) => {
      const { query, replace, regex, caseSensitive, paths } = request.body;
      if (!query) {
        return reply.status(400).send({ error: "query required" });
      }

      let re: RegExp;
      if (regex) {
        try {
          re = new RegExp(query, caseSensitive ? "g" : "gi");
        } catch {
          return reply.status(400).send({ error: "Invalid regex pattern" });
        }
      } else {
        const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        re = new RegExp(escaped, caseSensitive ? "g" : "gi");
      }

      const tree = await scanVault(vaultRoot);
      const files = flattenFiles(tree);
      let totalReplacements = 0;
      const changedFiles: string[] = [];

      for (const file of files) {
        if (file.extension !== "md") continue;
        if (paths && !paths.includes(file.path)) continue;
        const fullPath = join(vaultRoot, file.path);
        const content = await readFile(fullPath, "utf-8");
        re.lastIndex = 0;
        const newContent = content.replace(re, replace);
        if (newContent !== content) {
          await writeFile(fullPath, newContent, "utf-8");
          // Count replacements
          re.lastIndex = 0;
          const matches = content.match(re);
          totalReplacements += matches?.length ?? 0;
          changedFiles.push(file.path);
        }
      }

      return { totalReplacements, changedFiles };
    },
  );

  // Fuzzy match: characters in query must appear in order in target.
  // Returns score (higher = better) or -1 if no match.
  function fuzzyScore(query: string, target: string): number {
    const q = query.toLowerCase();
    const t = target.toLowerCase();
    if (!q) return 0;
    // Exact match bonus
    if (t === q) return 100;
    if (t.startsWith(q)) return 90;
    if (t.includes(q)) return 80;

    let qi = 0;
    let score = 0;
    let prevMatchIdx = -2;
    let wordBoundary = true;

    for (let ti = 0; ti < t.length && qi < q.length; ti++) {
      if (t[ti] === q[qi]) {
        score += 10;
        // Consecutive match bonus
        if (ti === prevMatchIdx + 1) score += 5;
        // Start-of-word bonus
        if (wordBoundary) score += 8;
        // First character bonus
        if (ti === 0) score += 3;
        prevMatchIdx = ti;
        qi++;
      }
      wordBoundary = t[ti] === "/" || t[ti] === " " || t[ti] === "-" || t[ti] === "_";
    }

    // All query chars must be matched
    if (qi < q.length) return -1;
    // Penalize long targets (prefer shorter names)
    score -= t.length * 0.5;
    return score;
  }

  // GET /api/vault/switcher?q=... — quick switcher (filenames + aliases + headings)
  app.get<{ Querystring: { q: string } }>(
    "/switcher",
    async (request, reply) => {
      const query = request.query.q?.trim() ?? "";

      const tree = await scanVault(vaultRoot);
      const files = flattenFiles(tree);
      const { notes } = await indexVault(vaultRoot, files);

      const candidates: Array<{
        path: string;
        name: string;
        type: "file" | "alias" | "heading";
        score: number;
        matches?: number[];
      }> = [];

      for (const file of files) {
        if (file.extension !== "md") continue;
        const name = file.path.replace(/\.md$/, "");

        // Score against basename (what user sees) and full path
        const basename = name.split("/").pop() ?? name;
        const baseScore = fuzzyScore(query, basename);
        const pathScore = fuzzyScore(query, name);
        const bestScore = Math.max(baseScore, pathScore);

        if (!query || bestScore >= 0) {
          // Compute match indices for highlighting
          const matchTarget = baseScore >= pathScore ? basename : name;
          const matches = fuzzyMatchIndices(query.toLowerCase(), matchTarget.toLowerCase());
          candidates.push({
            path: file.path,
            name: basename,
            type: "file",
            score: bestScore,
            matches,
          });
        }

        // Score alias matches
        const note = notes.find((n) => n.path === file.path);
        if (note) {
          for (const alias of note.aliases) {
            const s = fuzzyScore(query, alias);
            if (!query || s >= 0) {
              candidates.push({
                path: file.path,
                name: alias,
                type: "alias",
                score: s,
                matches: fuzzyMatchIndices(query.toLowerCase(), alias.toLowerCase()),
              });
            }
          }
        }
      }

      // Sort by score (highest first), then alphabetically
      candidates.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

      return { query, candidates: candidates.slice(0, 20) };
    },
  );

  // Compute match indices for fuzzy highlighting
  function fuzzyMatchIndices(query: string, target: string): number[] {
    const indices: number[] = [];
    let qi = 0;
    for (let ti = 0; ti < target.length && qi < query.length; ti++) {
      if (target[ti] === query[qi]) {
        indices.push(ti);
        qi++;
      }
    }
    return qi === query.length ? indices : [];
  }

  // GET /api/vault/graph — all notes and their resolved links for graph view
  app.get("/graph", async () => {
    const tree = await scanVault(vaultRoot);
    const files = flattenFiles(tree);
    const { notes, index } = await indexVault(vaultRoot, files);

    const nodes: Array<{ id: string; name: string; wordCount?: number }> = [];
    const edges: Array<{ source: string; target: string }> = [];

    for (const file of files) {
      if (file.extension !== "md") continue;
      let wordCount = 0;
      try {
        const content = await readFile(join(vaultRoot, file.path), "utf-8");
        // Strip frontmatter then count words
        const body = content.replace(/^---[\t ]*\r?\n[\s\S]*?\n---[\t ]*(?:\r?\n|$)/, "");
        wordCount = body.split(/\s+/).filter(Boolean).length;
      } catch { /* ignore */ }
      nodes.push({
        id: file.path,
        name: file.path.replace(/\.md$/, "").split("/").pop() ?? file.path,
        wordCount,
      });
    }

    const nodeIds = new Set(nodes.map((n) => n.id));

    for (const note of notes) {
      for (const link of note.links) {
        const resolved = resolveLink(link.target, note.path, index);
        if (resolved && nodeIds.has(resolved)) {
          edges.push({ source: note.path, target: resolved });
        }
      }
    }

    return { nodes, edges };
  });

  // GET /api/vault/stats — vault statistics
  app.get("/stats", async () => {
    const tree = await scanVault(vaultRoot);
    const files = flattenFiles(tree);
    let totalNotes = 0;
    let totalAttachments = 0;
    let totalWords = 0;
    let totalSize = 0;

    for (const file of files) {
      totalSize += file.size;
      if (file.extension === "md") {
        totalNotes++;
        try {
          const content = await readFile(join(vaultRoot, file.path), "utf-8");
          const body = content.replace(/^---[\t ]*\r?\n[\s\S]*?\n---[\t ]*(?:\r?\n|$)/, "");
          totalWords += body.split(/\s+/).filter(Boolean).length;
        } catch { /* ignore */ }
      } else {
        totalAttachments++;
      }
    }

    return {
      totalNotes,
      totalAttachments,
      totalWords,
      totalSize,
      totalFiles: files.length,
    };
  });

  // GET /api/vault/tags — all tags across the vault with note paths
  app.get("/tags", async () => {
    const tree = await scanVault(vaultRoot);
    const files = flattenFiles(tree);
    const { notes } = await indexVault(vaultRoot, files);

    const tagMap: Record<string, string[]> = {};

    for (const note of notes) {
      for (const tag of note.tags) {
        const name = tag.name;
        if (!tagMap[name]) tagMap[name] = [];
        tagMap[name].push(note.path);
      }
    }

    const tags = Object.entries(tagMap)
      .map(([name, paths]) => {
        const unique = [...new Set(paths)];
        return { name, count: unique.length, paths: unique };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return { tags };
  });

  // GET /api/vault/snippets — list available CSS snippets
  app.get("/snippets", async () => {
    const snippetsDir = join(vaultRoot, ".obsidian", "snippets");
    try {
      const entries = await readdir(snippetsDir);
      const snippets: Array<{ name: string; filename: string }> = [];
      for (const entry of entries) {
        if (entry.endsWith(".css")) {
          snippets.push({
            name: entry.replace(/\.css$/, ""),
            filename: entry,
          });
        }
      }
      return { snippets };
    } catch {
      return { snippets: [] };
    }
  });

  // GET /api/vault/plugins — list installed plugins
  app.get("/plugins", async () => {
    const pluginsDir = join(vaultRoot, ".obsidian", "plugins");
    try {
      const entries = await readdir(pluginsDir, { withFileTypes: true });
      const plugins: Array<{
        id: string;
        name: string;
        version: string;
        description: string;
        author: string;
        isDesktopOnly: boolean;
        hasMain: boolean;
      }> = [];

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        try {
          const manifestRaw = await readFile(
            join(pluginsDir, entry.name, "manifest.json"),
            "utf-8",
          );
          const manifest = JSON.parse(manifestRaw);
          let hasMain = false;
          try {
            await readFile(join(pluginsDir, entry.name, "main.js"));
            hasMain = true;
          } catch {}

          plugins.push({
            id: manifest.id ?? entry.name,
            name: manifest.name ?? entry.name,
            version: manifest.version ?? "unknown",
            description: manifest.description ?? "",
            author: manifest.author ?? "unknown",
            isDesktopOnly: manifest.isDesktopOnly ?? false,
            hasMain,
          });
        } catch {
          // Skip plugins without valid manifest
        }
      }

      return { plugins };
    } catch {
      return { plugins: [] };
    }
  });

  // GET /api/vault/plugin-source?id=... — get plugin main.js source
  app.get<{ Querystring: { id: string } }>(
    "/plugin-source",
    async (request, reply) => {
      const pluginId = request.query.id;
      if (!pluginId || pluginId.includes("..") || pluginId.includes("/")) {
        return reply.status(400).send({ error: "invalid plugin id" });
      }

      const pluginsDir = join(vaultRoot, ".obsidian", "plugins");
      try {
        // Verify not desktop-only
        const manifestRaw = await readFile(
          join(pluginsDir, pluginId, "manifest.json"),
          "utf-8",
        );
        const manifest = JSON.parse(manifestRaw);
        if (manifest.isDesktopOnly) {
          return reply
            .status(403)
            .send({ error: "desktop-only plugin cannot be loaded in web" });
        }

        const source = await readFile(
          join(pluginsDir, pluginId, "main.js"),
          "utf-8",
        );
        return { id: pluginId, source };
      } catch {
        return reply.status(404).send({ error: "plugin source not found" });
      }
    },
  );

  // GET /api/vault/snippet?name=... — get CSS snippet content
  app.get<{ Querystring: { name: string } }>(
    "/snippet",
    async (request, reply) => {
      const name = request.query.name;
      if (!name || name.includes("..") || name.includes("/")) {
        return reply.status(400).send({ error: "invalid snippet name" });
      }
      const snippetPath = join(vaultRoot, ".obsidian", "snippets", name);
      try {
        const content = await readFile(snippetPath, "utf-8");
        return { name, content };
      } catch {
        return reply.status(404).send({ error: "snippet not found" });
      }
    },
  );

  // POST /api/vault/upload — upload a file (image) to the vault
  app.post<{ Querystring: { filename: string } }>(
    "/upload",
    async (request, reply) => {
      const filename = request.query.filename;
      if (!filename || filename.includes("..")) {
        return reply.status(400).send({ error: "invalid filename" });
      }

      const attachDir = join(vaultRoot, "Attachments");
      await mkdir(attachDir, { recursive: true });

      // Deduplicate: if file exists, add numeric suffix
      const ext = filename.lastIndexOf(".") >= 0 ? filename.slice(filename.lastIndexOf(".")) : "";
      const base = filename.slice(0, filename.length - ext.length);
      let finalName = filename;
      let counter = 1;
      try {
        while (true) {
          await readFile(join(attachDir, finalName));
          finalName = `${base} ${counter}${ext}`;
          counter++;
        }
      } catch {
        // File doesn't exist — good, use finalName
      }

      const body = request.body as Buffer;
      await writeFile(join(attachDir, finalName), body);

      return { path: `Attachments/${finalName}`, filename: finalName };
    },
  );
}
