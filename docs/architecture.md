# Architecture

## System Shape

The system should be split into six layers:

1. web client
2. API gateway
3. vault service
4. index and graph service
5. job runner and automation service
6. plugin runtime

## Web Client

Responsibilities:

- workspace shell
- tabs, panes, and sidebars
- markdown reader and editor
- command palette and quick switcher
- graph and canvas views
- theme and snippet application
- auth session handling
- local cache and offline support

Likely stack:

- TypeScript
- React
- CodeMirror 6
- state layer chosen after initial scaffold

## API Gateway

Responsibilities:

- session-authenticated HTTP API
- WebSocket events for file changes, indexing, and long jobs
- tenant and vault authorization
- rate limiting and audit hooks

## Vault Service

Responsibilities:

- vault discovery and metadata
- file CRUD
- path and wikilink resolution
- rename propagation rules
- properties, aliases, tags, and attachments
- storage adapter abstraction

Core adapters to consider:

- local mirrored vaults
- Git-backed vaults
- cloud object storage backed vaults
- optional public Obsidian tooling integration if clearly allowed

## Index And Graph Service

Responsibilities:

- full-text index
- backlink graph
- tag index
- alias and heading index
- graph view query layer
- quick switcher candidate ranking

## Job Runner And Automation Service

Responsibilities:

- long-running tasks
- agent workflows
- import/export
- background indexing
- maintenance and repair tasks

## Plugin Runtime

Design goal:

Run only browser-safe plugins directly. Anything else must be blocked or moved behind an explicit server capability boundary.

Capabilities to gate:

- vault reads
- vault writes
- search access
- command registration
- editor decorations
- view registration
- outbound network
- server-side execution

Runtime options to evaluate:

- isolated iframe runtime
- web worker runtime
- server-side adapter for safe background tasks

## Data Model Priorities

Model these first:

- vault
- file
- folder
- note metadata
- properties
- aliases
- tags
- links
- embeds
- canvas documents
- workspace state

## Non-Goals For The First Pass

- full plugin parity
- full theme parity
- exact DOM parity with desktop Obsidian
- private protocol dependence
