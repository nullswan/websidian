import { describe, it, expect } from "vitest";
import { extractLinks, extractEmbeds, extractInlineTags, parseNote } from "../parser.js";

describe("extractLinks", () => {
  it("extracts simple wikilinks", () => {
    const links = extractLinks("See [[Some Note]] for details.");
    expect(links).toHaveLength(1);
    expect(links[0].target).toBe("Some Note");
    expect(links[0].display).toBeUndefined();
    expect(links[0].line).toBe(1);
  });

  it("extracts wikilinks with display text", () => {
    const links = extractLinks("Check [[Target|displayed text]] here.");
    expect(links[0].target).toBe("Target");
    expect(links[0].display).toBe("displayed text");
  });

  it("extracts wikilinks with heading targets", () => {
    const links = extractLinks("See [[Note#Section]] for more.");
    expect(links[0].target).toBe("Note#Section");
  });

  it("extracts multiple links on multiple lines", () => {
    const body = "Line one [[A]]\nLine two [[B]] and [[C|see C]]";
    const links = extractLinks(body);
    expect(links).toHaveLength(3);
    expect(links[0]).toMatchObject({ target: "A", line: 1 });
    expect(links[1]).toMatchObject({ target: "B", line: 2 });
    expect(links[2]).toMatchObject({ target: "C", display: "see C", line: 2 });
  });

  it("does not match embeds", () => {
    const links = extractLinks("![[embedded]] and [[normal]]");
    expect(links).toHaveLength(1);
    expect(links[0].target).toBe("normal");
  });
});

describe("extractEmbeds", () => {
  it("extracts embeds", () => {
    const embeds = extractEmbeds("![[image.png]]");
    expect(embeds).toHaveLength(1);
    expect(embeds[0].target).toBe("image.png");
  });

  it("extracts heading embeds", () => {
    const embeds = extractEmbeds("![[Note#Section]]");
    expect(embeds[0].target).toBe("Note#Section");
  });
});

describe("extractInlineTags", () => {
  it("extracts inline tags", () => {
    const tags = extractInlineTags("Some text #hello #world here.");
    expect(tags).toHaveLength(2);
    expect(tags[0].name).toBe("hello");
    expect(tags[1].name).toBe("world");
  });

  it("extracts nested tags", () => {
    const tags = extractInlineTags("A #nested/tag here.");
    expect(tags[0].name).toBe("nested/tag");
  });

  it("does not match tags inside words", () => {
    // #tag at start of line should match
    const tags = extractInlineTags("#valid not-a-#tag");
    expect(tags).toHaveLength(1);
    expect(tags[0].name).toBe("valid");
  });
});

describe("parseNote", () => {
  it("parses a complete note", () => {
    const content = `---
aliases:
  - Home
tags:
  - meta
---

# Welcome

See [[Other Note]] and ![[image.png]]

#inline-tag
`;

    const meta = parseNote("Welcome.md", content);
    expect(meta.path).toBe("Welcome.md");
    expect(meta.aliases).toEqual(["Home"]);
    expect(meta.tags.map((t) => t.name)).toContain("meta");
    expect(meta.tags.map((t) => t.name)).toContain("inline-tag");
    expect(meta.links).toHaveLength(1);
    expect(meta.links[0].target).toBe("Other Note");
    expect(meta.embeds).toHaveLength(1);
    expect(meta.embeds[0].target).toBe("image.png");
  });
});
