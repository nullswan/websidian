import type { WikiLink, Embed, Tag, NoteMeta } from "./note.js";
import {
  parseFrontmatter,
  extractAliases,
  extractFrontmatterTags,
} from "./frontmatter.js";

/** Regex for wikilinks: [[target]] or [[target|display]] */
const WIKILINK_RE = /(?<!!)\[\[([^\]|]+?)(?:\|([^\]]*?))?\]\]/g;

/** Regex for embeds: ![[target]] */
const EMBED_RE = /!\[\[([^\]]+?)\]\]/g;

/** Regex for inline tags: #tag or #nested/tag (not inside frontmatter) */
const INLINE_TAG_RE = /(?:^|[\s,;(])#([a-zA-Z][\w/-]*)/g;

/** Extract all wikilinks from markdown body text */
export function extractLinks(body: string, lineOffset = 0): WikiLink[] {
  const links: WikiLink[] = [];
  const lines = body.split("\n");
  for (let i = 0; i < lines.length; i++) {
    WIKILINK_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = WIKILINK_RE.exec(lines[i])) !== null) {
      links.push({
        target: match[1].trim(),
        display: match[2]?.trim(),
        line: i + 1 + lineOffset,
      });
    }
  }
  return links;
}

/** Extract all embeds from markdown body text */
export function extractEmbeds(body: string, lineOffset = 0): Embed[] {
  const embeds: Embed[] = [];
  const lines = body.split("\n");
  for (let i = 0; i < lines.length; i++) {
    EMBED_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = EMBED_RE.exec(lines[i])) !== null) {
      embeds.push({
        target: match[1].trim(),
        line: i + 1 + lineOffset,
      });
    }
  }
  return embeds;
}

/** Extract inline #tags from markdown body text */
export function extractInlineTags(body: string, lineOffset = 0): Tag[] {
  const tags: Tag[] = [];
  const lines = body.split("\n");
  for (let i = 0; i < lines.length; i++) {
    INLINE_TAG_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = INLINE_TAG_RE.exec(lines[i])) !== null) {
      tags.push({
        name: match[1],
        line: i + 1 + lineOffset,
      });
    }
  }
  return tags;
}

/** Parse a full markdown note into structured metadata */
export function parseNote(path: string, content: string): NoteMeta {
  const { frontmatter, bodyStart } = parseFrontmatter(content);
  const body = content.slice(bodyStart);

  // Count lines in frontmatter section for accurate line offsets
  const fmLineCount =
    bodyStart > 0 ? content.slice(0, bodyStart).split("\n").length - 1 : 0;

  const aliases = extractAliases(frontmatter);
  const fmTags = extractFrontmatterTags(frontmatter);
  const inlineTags = extractInlineTags(body, fmLineCount);

  // Combine frontmatter tags (reported at line 1) and inline tags
  const tags: Tag[] = [
    ...fmTags.map((name) => ({ name, line: 1 })),
    ...inlineTags,
  ];

  const links = extractLinks(body, fmLineCount);
  const embeds = extractEmbeds(body, fmLineCount);

  return {
    path,
    frontmatter,
    aliases,
    tags,
    links,
    embeds,
  };
}
