import { readdir, stat, readFile } from "node:fs/promises";
import { join, relative, extname } from "node:path";
import type { VaultConfig, VaultEntry, VaultFile, VaultFolder } from "./types.js";
import type { NoteMeta } from "./note.js";
import { parseNote } from "./parser.js";
import { buildResolverIndex, type ResolverIndex } from "./resolver.js";

/** Load vault configuration from .obsidian/app.json */
export async function loadVaultConfig(vaultRoot: string): Promise<VaultConfig> {
  const configPath = join(vaultRoot, ".obsidian", "app.json");
  try {
    const raw = await readFile(configPath, "utf-8");
    const config = JSON.parse(raw);
    return {
      name: vaultRoot.split("/").pop() ?? "vault",
      root: vaultRoot,
      attachmentFolder: config.attachmentFolderPath,
    };
  } catch {
    return {
      name: vaultRoot.split("/").pop() ?? "vault",
      root: vaultRoot,
    };
  }
}

/** Recursively scan a vault directory and return the file tree */
export async function scanVault(vaultRoot: string): Promise<VaultEntry[]> {
  return scanDir(vaultRoot, vaultRoot);
}

async function scanDir(dir: string, root: string): Promise<VaultEntry[]> {
  const entries: VaultEntry[] = [];
  const items = await readdir(dir, { withFileTypes: true });

  for (const item of items) {
    // Skip .obsidian and hidden files
    if (item.name.startsWith(".")) continue;

    const fullPath = join(dir, item.name);
    const relPath = relative(root, fullPath);

    if (item.isDirectory()) {
      const children = await scanDir(fullPath, root);
      entries.push({ kind: "folder", path: relPath, children });
    } else if (item.isFile()) {
      const s = await stat(fullPath);
      const ext = extname(item.name).slice(1);
      entries.push({
        kind: "file",
        path: relPath,
        extension: ext,
        size: s.size,
        mtime: s.mtimeMs,
      });
    }
  }

  return entries.sort((a, b) => {
    // Folders first, then alphabetical
    if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
    return a.path.localeCompare(b.path);
  });
}

/** Flatten a vault tree into a list of files */
export function flattenFiles(entries: VaultEntry[]): VaultFile[] {
  const files: VaultFile[] = [];
  for (const entry of entries) {
    if (entry.kind === "file") {
      files.push(entry);
    } else {
      files.push(...flattenFiles(entry.children));
    }
  }
  return files;
}

/** Parse all markdown notes in a vault and build the resolver index */
export async function indexVault(
  vaultRoot: string,
  files: VaultFile[],
): Promise<{ notes: NoteMeta[]; index: ResolverIndex }> {
  const mdFiles = files.filter((f) => f.extension === "md");
  const notes: NoteMeta[] = [];

  for (const file of mdFiles) {
    const content = await readFile(join(vaultRoot, file.path), "utf-8");
    notes.push(parseNote(file.path, content));
  }

  const aliases = notes.map((n) => ({ path: n.path, aliases: n.aliases }));
  const index = buildResolverIndex(files, aliases);

  return { notes, index };
}
