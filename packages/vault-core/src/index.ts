// @obsidian-web/vault-core
// Domain models for vault-compatible file operations

export { type VaultConfig, type VaultFile, type VaultFolder, type VaultEntry } from "./types.js";
export { type NoteMeta, type FrontMatter, type WikiLink, type Embed, type Tag } from "./note.js";
export { parseFrontmatter, extractAliases, extractFrontmatterTags } from "./frontmatter.js";
export { parseNote, extractLinks, extractEmbeds, extractInlineTags } from "./parser.js";
export { buildResolverIndex, resolveLink, stripFragment, type ResolverIndex } from "./resolver.js";
export { loadVaultConfig, scanVault, flattenFiles, indexVault } from "./vault.js";
