/** Configuration for a vault, mirrors .obsidian/app.json basics */
export interface VaultConfig {
  name: string;
  root: string;
  attachmentFolder?: string;
}

/** A file within the vault */
export interface VaultFile {
  kind: "file";
  /** Path relative to vault root, e.g. "Daily Notes/2026-04-04.md" */
  path: string;
  /** File extension without dot */
  extension: string;
  /** Size in bytes */
  size: number;
  /** Last modified timestamp (ms since epoch) */
  mtime: number;
  /** Creation timestamp (ms since epoch) */
  ctime: number;
}

/** A folder within the vault */
export interface VaultFolder {
  kind: "folder";
  path: string;
  children: VaultEntry[];
}

export type VaultEntry = VaultFile | VaultFolder;
