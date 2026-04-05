import { parse as parseYaml } from "yaml";
import type { FrontMatter } from "./note.js";

const FRONTMATTER_RE = /^---[ \t]*\r?\n([\s\S]*?\n)?---[ \t]*(?:\r?\n|$)/;

export interface ParsedFrontmatter {
  frontmatter: FrontMatter;
  /** Byte offset where body content starts (after closing ---) */
  bodyStart: number;
}

/** Extract and parse YAML frontmatter from a markdown string */
export function parseFrontmatter(content: string): ParsedFrontmatter {
  const match = FRONTMATTER_RE.exec(content);
  if (!match) {
    return { frontmatter: {}, bodyStart: 0 };
  }

  try {
    const raw = parseYaml(match[1]);
    const frontmatter: FrontMatter =
      raw && typeof raw === "object" && !Array.isArray(raw)
        ? (raw as FrontMatter)
        : {};
    return {
      frontmatter,
      bodyStart: match[0].length,
    };
  } catch {
    return { frontmatter: {}, bodyStart: match[0].length };
  }
}

/** Extract aliases from parsed frontmatter */
export function extractAliases(fm: FrontMatter): string[] {
  const raw = fm.aliases ?? fm.alias;
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") return [raw];
  return [];
}

/** Extract tags from parsed frontmatter */
export function extractFrontmatterTags(fm: FrontMatter): string[] {
  const raw = fm.tags ?? fm.tag;
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") return raw.split(/[,\s]+/).filter(Boolean);
  return [];
}
