# Security Model

## Baseline

Treat this as a multi-tenant document system with code execution pressure from plugins and automations. The biggest risks are data exposure, unsafe plugin execution, XSS in markdown rendering, and excessive backend privileges.

## Core Controls

### Authentication

- session-based auth for browser clients
- short-lived access tokens for APIs if needed
- optional device and personal access tokens later

### Authorization

- every request is scoped by user and vault
- server-enforced checks, never client-only
- read and write capabilities separated cleanly

### Content Security

- sanitize rendered markdown HTML
- restrict or rewrite raw HTML where needed
- strong CSP for the app shell
- safe handling for embeds and attachments

### Plugin Isolation

- browser-safe plugins run in sandboxed environments
- each plugin receives explicit capabilities
- no unrestricted filesystem, process, or network access
- unsupported plugins are blocked, not half-run

### Automation Safety

- agent and job execution is auditable
- background jobs have per-vault scope
- destructive operations require explicit policy

### Auditability

- log authentication events
- log vault mutations
- log plugin installation and capability grants
- log API key creation and use

## Security Questions To Resolve

- whether snippets can execute arbitrary CSS against sensitive UI surfaces
- how to scope plugin network access safely
- how to prevent cross-vault data leakage in indexes
- how to securely store secrets for adapters and automations

## First Security Deliverables

1. capability model for plugins and jobs
2. markdown rendering threat model
3. tenant isolation tests
4. audit log schema
