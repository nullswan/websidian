# Sync Strategy

## Principle

Prefer a storage adapter model over a single sync implementation.

The product should work with a vault abstraction first. Sync is then one or more adapter strategies layered underneath.

## Initial Modes

### Mode A: Single-User Local Mirror

Best for early development.

- a server-side process has access to a canonical vault directory
- the web app reads and writes through the vault service
- file watcher events update indexes and clients

### Mode B: Git-Backed Vault

Good for transparent versioning and collaboration experiments.

- commits and pulls are controlled by the backend
- conflicts are surfaced explicitly
- sync state is decoupled from editor state

### Mode C: Object Storage Backed Vault

Good for multi-tenant hosted operation.

- markdown and assets live in object storage
- metadata and indexes live in app storage
- writes are versioned

## Optional Public Obsidian Tooling Integration

If public interfaces and terms allow it, evaluate:

- Obsidian Headless
- Obsidian Sync Headless
- Obsidian CLI driven workflows

These should be adapters, not architectural foundations.

## Conflict Model

Support these states explicitly:

- clean
- locally modified
- remotely modified
- conflicted
- deleted remotely

## Offline Model

The client should be local-first:

- edits land in local state immediately
- changes are queued for sync
- the server acknowledges versioned writes
- conflicts are surfaced with clear recovery

## First Implementation Recommendation

Start with Mode A plus versioned writes and event streaming.

Reasons:

- fastest path to a working system
- easiest way to test vault semantics
- no protocol dependency
- makes later adapter work easier
