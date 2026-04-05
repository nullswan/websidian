/** Parsed YAML frontmatter key-value pairs */
export type FrontMatter = Record<string, unknown>;

/** Metadata extracted from a markdown note */
export interface NoteMeta {
  /** Path relative to vault root */
  path: string;
  /** Parsed frontmatter properties */
  frontmatter: FrontMatter;
  /** Aliases from frontmatter */
  aliases: string[];
  /** Tags from both frontmatter and inline #tags */
  tags: Tag[];
  /** Wikilinks found in the body */
  links: WikiLink[];
  /** Embeds found in the body */
  embeds: Embed[];
}

/** A single tag reference */
export interface Tag {
  /** Tag text without the leading # */
  name: string;
  /** Line number (1-based) where this tag appears */
  line: number;
}

/** A wikilink: [[target]] or [[target|display]] or [[target#heading]] */
export interface WikiLink {
  /** Raw link target, e.g. "Some Note" or "Some Note#Heading" */
  target: string;
  /** Optional display text after | */
  display?: string;
  /** Line number (1-based) */
  line: number;
}

/** An embed: ![[target]] */
export interface Embed {
  /** Raw embed target */
  target: string;
  /** Line number (1-based) */
  line: number;
}
