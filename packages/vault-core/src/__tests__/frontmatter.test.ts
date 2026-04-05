import { describe, it, expect } from "vitest";
import {
  parseFrontmatter,
  extractAliases,
  extractFrontmatterTags,
} from "../frontmatter.js";

describe("parseFrontmatter", () => {
  it("parses YAML frontmatter", () => {
    const content = `---
title: Test Note
tags:
  - one
  - two
---

# Body here`;

    const result = parseFrontmatter(content);
    expect(result.frontmatter.title).toBe("Test Note");
    expect(result.frontmatter.tags).toEqual(["one", "two"]);
    expect(result.bodyStart).toBeGreaterThan(0);
  });

  it("returns empty for no frontmatter", () => {
    const result = parseFrontmatter("# Just a heading\n\nSome text.");
    expect(result.frontmatter).toEqual({});
    expect(result.bodyStart).toBe(0);
  });

  it("handles malformed YAML gracefully", () => {
    const content = `---
: broken: yaml: here
---

Body`;
    const result = parseFrontmatter(content);
    // Should not throw, returns empty or best-effort
    expect(result.bodyStart).toBeGreaterThan(0);
  });

  it("handles empty frontmatter", () => {
    const content = `---
---

Body`;
    const result = parseFrontmatter(content);
    expect(result.frontmatter).toEqual({});
    expect(result.bodyStart).toBeGreaterThan(0);
  });
});

describe("extractAliases", () => {
  it("extracts array aliases", () => {
    expect(extractAliases({ aliases: ["Home", "Start"] })).toEqual([
      "Home",
      "Start",
    ]);
  });

  it("extracts single string alias", () => {
    expect(extractAliases({ aliases: "Home" })).toEqual(["Home"]);
  });

  it("supports alias key (singular)", () => {
    expect(extractAliases({ alias: "Home" })).toEqual(["Home"]);
  });

  it("returns empty for no aliases", () => {
    expect(extractAliases({})).toEqual([]);
  });
});

describe("extractFrontmatterTags", () => {
  it("extracts array tags", () => {
    expect(extractFrontmatterTags({ tags: ["one", "two"] })).toEqual([
      "one",
      "two",
    ]);
  });

  it("extracts comma-separated string tags", () => {
    expect(extractFrontmatterTags({ tags: "one, two, three" })).toEqual([
      "one",
      "two",
      "three",
    ]);
  });

  it("supports tag key (singular)", () => {
    expect(extractFrontmatterTags({ tag: "solo" })).toEqual(["solo"]);
  });
});
