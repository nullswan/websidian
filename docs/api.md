# API Reference

All vault endpoints require authentication when `AUTH_ENABLED=true` (default).

## Authentication

### POST /api/auth/register
Create a new user account.
- Body: `{ "username": string, "password": string }`
- Returns: `{ "username": string, "registered": true }`

### POST /api/auth/login
Sign in with existing credentials.
- Body: `{ "username": string, "password": string }`
- Returns: `{ "username": string, "loggedIn": true }`

### POST /api/auth/logout
End current session.
- Returns: `{ "loggedOut": true }`

### GET /api/auth/me
Check current authentication status.
- Returns: `{ "authenticated": boolean, "username"?: string }`

## Vault Operations

### GET /api/vault/config
Get vault metadata.
- Returns: `{ "name": string, "root": string }`

### GET /api/vault/tree
Get full file tree.
- Returns: `{ "tree": VaultEntry[] }`

### GET /api/vault/files
Get flat file list.
- Returns: `{ "files": VaultFile[] }`

### GET /api/vault/file?path=...
Read a file's content (text).
- Returns: `{ "path": string, "content": string }`

### GET /api/vault/raw?path=...
Serve a file's raw binary content with correct MIME type (for images, PDFs, etc.).
- Returns: Raw file data with appropriate Content-Type header

### PUT /api/vault/file
Create or update a file.
- Body: `{ "path": string, "content": string }`
- Returns: `{ "path": string, "written": true }`

### DELETE /api/vault/file?path=...
Delete a file.
- Returns: `{ "path": string, "deleted": true }`

### POST /api/vault/rename
Rename or move a file.
- Body: `{ "from": string, "to": string }`
- Returns: `{ "from": string, "to": string, "renamed": true }`

## Note Metadata

### GET /api/vault/note?path=...
Get parsed note metadata (frontmatter, aliases, tags, links, embeds).
- Returns: `NoteMeta`

### GET /api/vault/resolve?target=...&from=...
Resolve a wikilink using shortest-path resolution.
- Returns: `{ "target": string, "from": string, "resolved": string | null }`

### GET /api/vault/backlinks?path=...
Find notes that link to this note.
- Returns: `{ "path": string, "backlinks": Array<{ path: string, context: string }> }`

## Search

### GET /api/vault/search?q=...
Full-text search across vault.
- Returns: `{ "query": string, "results": Array<{ path: string, matches: Array<{ line: number, text: string }> }> }`

### GET /api/vault/switcher?q=...
Quick switcher search (filenames + aliases, scored).
- Returns: `{ "query": string, "candidates": Array<{ path: string, name: string, type: string, score: number }> }`

## Graph

### GET /api/vault/graph
Get all notes and their resolved links for graph visualization.
- Returns: `{ "nodes": Array<{ id: string, name: string }>, "edges": Array<{ source: string, target: string }> }`

## CSS Snippets

### GET /api/vault/snippets
List available CSS snippets from `.obsidian/snippets/`.
- Returns: `{ "snippets": Array<{ name: string, filename: string }> }`

### GET /api/vault/snippet?name=...
Get CSS snippet content.
- Returns: `{ "name": string, "content": string }`

## Tags

### GET /api/vault/tags
Get all tags across the vault with note paths (deduplicated).
- Returns: `{ "tags": Array<{ name: string, count: number, paths: string[] }> }`

## Plugins

### GET /api/vault/plugins
List installed community plugins from `.obsidian/plugins/`.
- Returns: `{ "plugins": Array<{ id: string, name: string, version: string, description: string, author: string, isDesktopOnly: boolean, hasMain: boolean }> }`

### GET /api/vault/plugin-source?id=...
Get a web-compatible plugin's `main.js` source for browser sandbox execution.
- Returns: `{ "id": string, "source": string }`
- Returns 403 if plugin is desktop-only
- Returns 404 if plugin or main.js not found
