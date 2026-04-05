// Re-export vault types for use in the web client.
// These mirror the vault-core types but are kept as plain interfaces
// for the API response shape (the API returns JSON, not class instances).

export interface VaultFileEntry {
  kind: "file";
  path: string;
  extension: string;
  size: number;
  mtime: number;
}

export interface VaultFolderEntry {
  kind: "folder";
  path: string;
  children: VaultEntry[];
}

export type VaultEntry = VaultFileEntry | VaultFolderEntry;
