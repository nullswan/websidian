# Plugin Compatibility Matrix

## Categories

### Category A: Browser-Safe By Design

Likely first-wave support candidates:

- editor decoration plugins
- markdown post-processors that do not need Node or Electron
- command palette extensions
- sidebar or custom view plugins built on browser-safe APIs

Strategy:

- run in a sandboxed browser runtime
- expose a limited compatibility API

### Category B: Partial Or Reimplemented Support

Examples:

- query and metadata plugins
- graph and canvas helper plugins
- theme-adjacent plugins
- plugins that can be translated into backend services plus browser UI

Strategy:

- provide compatibility shims only if behavior is clear and testable
- prefer native platform features over fragile shims

### Category C: Desktop-Only

Examples:

- plugins that use Node built-ins like `fs`, `path`, `child_process`, or `net`
- plugins that depend on Electron APIs
- plugins that assume direct local filesystem access
- plugins that launch OS-level apps or scripts

Strategy:

- detect and block clearly
- explain why
- suggest nearest supported alternative if one exists

## Detection Plan

At minimum, inspect:

- plugin manifest
- `isDesktopOnly` flag
- imports of Node or Electron modules
- requested capabilities

## UX Rule

Never pretend a desktop-only plugin works on the web. Surface compatibility honestly:

- supported
- partially supported
- unsupported

## Engineering Rule

The host product should not become a Node-in-the-browser trap. If supporting a plugin requires unsafe host capabilities, do not support it by default.
