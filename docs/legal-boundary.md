# Legal Boundary

As of April 4, 2026, this project should assume the following boundary:

- Obsidian's official help docs say the product is not available as a web-based application.
- Obsidian Publish is a publishing product, not a full browser-hosted Obsidian client.
- Official Publish docs describe minimal support for many community plugins.
- Obsidian's Terms of Service should be reviewed before any commercial launch or compatibility claim.

Primary references:

- Obsidian Teams deploy docs: <https://obsidian.md/help/teams/deploy>
- Obsidian Publish limitations: <https://obsidian.md/help/publish/limitations>
- Obsidian plugin security: <https://obsidian.md/help/plugin-security>
- Obsidian manifest reference: <https://docs.obsidian.md/Reference/Manifest>
- Obsidian CLI: <https://obsidian.md/help/cli>
- Obsidian Headless: <https://obsidian.md/help/headless>
- Obsidian Sync Headless: <https://obsidian.md/help/sync/headless>
- Obsidian Terms: <https://obsidian.md/terms>

## Product Rule

This project is building a web-native compatibility layer, not a hosted copy of Obsidian.

Allowed direction:

- build a browser application that uses user-owned vault files and documented formats
- build original implementations of editor, search, graph, canvas, themes, APIs, and automation
- use public interfaces where available
- optionally integrate public Obsidian tooling only where contractually and technically allowed

Blocked direction:

- hosting the proprietary desktop app in the browser
- patching or repackaging the official client
- reverse-engineering private protocols as a primary strategy
- marketing a proprietary-hosted Obsidian clone as if it were the official product

## Practical Interpretation

The safe path is:

1. support vault compatibility
2. support documented file formats
3. support safe browser-native plugin APIs
4. clearly separate compatible behavior from official Obsidian internals

## Escalation Rule

If the roadmap drifts toward bundling, embedding, or exposing the proprietary app or private services, stop and mark the work `BLOCKED`.

For any serious commercial effort, get counsel to review the current Terms of Service and branding risks before launch.
