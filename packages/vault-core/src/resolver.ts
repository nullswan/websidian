import type { VaultFile } from "./types.js";

/**
 * Obsidian-compatible link resolver.
 *
 * Resolution strategy (matching Obsidian's "shortest path" default):
 * 1. Exact path match (with .md extension added if needed)
 * 2. Basename match — find all files whose basename matches the target
 *    - If exactly one match: return it
 *    - If multiple: prefer the one closest to the source file
 * 3. Alias match — check against note aliases
 */

export interface ResolverIndex {
  /** All files in the vault (relative paths) */
  files: VaultFile[];
  /** Map from basename (no extension) to list of full paths */
  basenameMap: Map<string, string[]>;
  /** Map from alias to full path */
  aliasMap: Map<string, string>;
}

/** Build the resolver index from a flat list of vault files and alias entries */
export function buildResolverIndex(
  files: VaultFile[],
  aliases: Array<{ path: string; aliases: string[] }>,
): ResolverIndex {
  const basenameMap = new Map<string, string[]>();

  for (const file of files) {
    // Index both notes (.md) and attachments (images, etc.) for embed resolution
    const basename = getBasename(file.path);
    const existing = basenameMap.get(basename) ?? [];
    existing.push(file.path);
    basenameMap.set(basename, existing);
  }

  const aliasMap = new Map<string, string>();
  for (const entry of aliases) {
    for (const alias of entry.aliases) {
      aliasMap.set(alias.toLowerCase(), entry.path);
    }
  }

  return { files, basenameMap, aliasMap };
}

/** Strip the heading/block fragment from a link target */
export function stripFragment(target: string): { path: string; fragment?: string } {
  const hashIdx = target.indexOf("#");
  if (hashIdx === -1) return { path: target };
  return {
    path: target.slice(0, hashIdx),
    fragment: target.slice(hashIdx + 1),
  };
}

/**
 * Resolve a wikilink target to a file path.
 * Returns null if no match is found.
 */
export function resolveLink(
  target: string,
  sourcePath: string,
  index: ResolverIndex,
): string | null {
  const { path: linkPath } = stripFragment(target);
  if (!linkPath) return null;

  // 1. Exact path match
  // If the link already has an extension, try as-is first
  if (linkPath.includes(".") && index.files.some((f) => f.path === linkPath)) {
    return linkPath;
  }
  const withExt = linkPath.endsWith(".md") ? linkPath : linkPath + ".md";
  if (index.files.some((f) => f.path === withExt)) {
    return withExt;
  }

  // 2. Basename match (shortest-path resolution)
  // Try both with and without extension stripped (e.g. "diagram.png" → "diagram")
  const basenameKey = getBasename(linkPath);
  const candidates = index.basenameMap.get(linkPath) ?? index.basenameMap.get(basenameKey);
  if (candidates) {
    // If target has an extension (e.g. "diagram.png"), filter to matching extension
    const hasExt = linkPath.includes(".") && !linkPath.endsWith(".md");
    const ext = hasExt ? linkPath.slice(linkPath.lastIndexOf(".")) : null;
    const filtered = ext ? candidates.filter(c => c.endsWith(ext)) : candidates;
    const pool = filtered.length > 0 ? filtered : candidates;
    if (pool.length === 1) return pool[0];
    // Multiple matches: pick closest to source
    return pickClosest(pool, sourcePath);
  }

  // 3. Alias match
  const aliasResult = index.aliasMap.get(linkPath.toLowerCase());
  if (aliasResult) return aliasResult;

  return null;
}

/** Get basename without extension from a path */
function getBasename(filePath: string): string {
  const parts = filePath.split("/");
  const filename = parts[parts.length - 1];
  const dotIdx = filename.lastIndexOf(".");
  return dotIdx === -1 ? filename : filename.slice(0, dotIdx);
}

/** Pick the candidate path closest to the source path */
function pickClosest(candidates: string[], sourcePath: string): string {
  const sourceDir = sourcePath.split("/").slice(0, -1).join("/");

  let best = candidates[0];
  let bestScore = -1;

  for (const candidate of candidates) {
    const candidateDir = candidate.split("/").slice(0, -1).join("/");
    const score = commonPrefixLength(sourceDir, candidateDir);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best;
}

function commonPrefixLength(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}
