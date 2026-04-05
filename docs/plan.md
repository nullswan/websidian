# Plan

## Objective

Build a high-fidelity web-native Obsidian-compatible product that works on real vaults, supports login and APIs, and has a credible plugin compatibility story without modifying or browser-hosting the official Obsidian application.

## Success Criteria

The project is successful when a user can:

- log in and open a real vault
- browse, edit, search, and link notes correctly
- use tabs, panes, workspaces, graph, and canvas
- apply themes and snippets
- call an API for core operations
- run `SKILL.md` based automations
- understand plugin compatibility clearly

## Milestones

### M0: Boundary And Foundation

Exit when:

- the legal boundary is explicit
- the system architecture is documented
- the first fixture vault exists
- the eval framework skeleton exists
- the initial app scaffold exists

### M1: Vault Kernel

Exit when:

- notes, folders, attachments, properties, aliases, tags, and wikilinks are modeled
- path resolution and rename propagation rules are documented and tested
- fixture vaults cover common edge cases

### M2: Reader And Editor

Exit when:

- note rendering works for core markdown and embeds
- editing works with a high-quality markdown editor
- frontmatter and properties are first-class
- file open, save, rename, and move flows work

### M3: Navigation And Search

Exit when:

- quick switcher exists
- command palette exists
- search and backlinks work
- outline, tags, and file explorer are usable

### M4: Workspace Fidelity

Exit when:

- tabs and split panes work
- sidebars and workspaces persist
- keyboard navigation and core hotkeys are credible

### M5: Visual Fidelity

Exit when:

- graph view exists
- canvas support is usable
- themes and CSS snippets work safely

### M6: Accounts, API, And Automation

Exit when:

- auth and sessions exist
- per-user vault access is enforced
- the core HTTP and WebSocket API is documented and partially implemented
- `SKILL.md` based automations can operate on a vault

### M7: Plugin Runtime

Exit when:

- plugin manifest scanning exists
- browser-safe plugins can run in a capability-gated sandbox
- unsupported desktop-only plugins are detected and surfaced clearly

### M8: Sync, Offline, And Hardening

Exit when:

- at least one production-grade sync strategy exists
- offline behavior is documented and tested
- audit logging, rate limiting, and security controls exist
- the eval scorecard shows sustained parity gains

## Initial Task Queue

Start here, in order, unless a stronger dependency appears:

1. scaffold the application repo structure
2. create a fixture vault with links, embeds, aliases, properties, tags, canvas, and attachments
3. define core TypeScript domain models for vaults, files, links, and properties
4. define file and link resolution behavior with tests
5. create the initial web shell and editor area
6. create the initial API surface and route stubs
7. create the eval scorecard and first parity checks
8. implement search index scaffolding
9. add auth/session scaffolding
10. start the plugin capability model

## Prioritization Rule

When choosing between tasks, prefer the one that is:

1. foundational
2. end-to-end
3. easy to verify
4. likely to unblock later parity work

## Anti-Goals

Do not spend early cycles on:

- perfect visual polish before core fidelity exists
- plugin breadth before the host runtime exists
- reverse engineering private protocols
- broad architecture churn without shipped artifacts
