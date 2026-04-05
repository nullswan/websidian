# Callout (Admonition) Rendering

**Date**: 2026-04-04
**Status**: Complete

## What was built

Added Obsidian-compatible callout rendering to the markdown pipeline. Callouts use the `> [!type] Title` blockquote syntax.

### Supported types (25 aliases)
note, info, abstract, summary, tip, hint, success, check, done, question, help, faq, warning, caution, attention, danger, error, bug, failure, fail, missing, example, quote, cite, todo

### Features
- Color-coded left border and tinted background per callout type
- Emoji icons matching Obsidian's visual language
- Markdown rendering inside callout body (bold, links, lists, etc.)
- Collapsible callouts: `[!type]-` starts collapsed, `[!type]+` starts expanded (uses `<details>`/`<summary>`)
- Custom titles: `[!note] Custom Title` or default to capitalized type name

### Implementation
- `md.core.ruler.push("callouts", ...)` — post-processes blockquote tokens
- Detects `[!type]` pattern in first inline content
- Replaces `blockquote_open`/`blockquote_close` with custom HTML
- Two lookup tables: `CALLOUT_COLORS` and `CALLOUT_ICONS`

## Verification
- Playwright screenshot shows 5 callouts rendering correctly: note (blue), tip (teal), warning (orange), danger (red), info collapsed (blue)
- Markdown formatting inside callouts renders properly

## Files changed
- `packages/web/src/lib/markdown.ts` — added callout core rule, color/icon tables
- `fixtures/test-vault/Concepts.md` — added callout examples section
