import { describe, it, expect } from "vitest";
import { buildResolverIndex, resolveLink, stripFragment } from "../resolver.js";
import type { VaultFile } from "../types.js";

function makeFile(path: string): VaultFile {
  return {
    kind: "file",
    path,
    extension: path.split(".").pop() ?? "",
    size: 100,
    mtime: Date.now(),
  };
}

const files: VaultFile[] = [
  makeFile("Welcome.md"),
  makeFile("Concepts.md"),
  makeFile("Projects/Project Alpha.md"),
  makeFile("Projects/Project Beta.md"),
  makeFile("Daily Notes/2026-04-04.md"),
  makeFile("Attachments/diagram.png"),
  makeFile("Canvas Example.canvas"),
];

const aliases = [
  { path: "Welcome.md", aliases: ["Home", "Start Here"] },
  { path: "Concepts.md", aliases: ["Ideas", "Key Concepts"] },
  { path: "Projects/Project Alpha.md", aliases: ["Alpha"] },
];

const index = buildResolverIndex(files, aliases);

describe("stripFragment", () => {
  it("strips heading fragment", () => {
    expect(stripFragment("Note#Heading")).toEqual({
      path: "Note",
      fragment: "Heading",
    });
  });

  it("returns path only when no fragment", () => {
    expect(stripFragment("Note")).toEqual({ path: "Note" });
  });
});

describe("resolveLink", () => {
  it("resolves exact path", () => {
    expect(resolveLink("Welcome", "Concepts.md", index)).toBe("Welcome.md");
  });

  it("resolves exact path with .md extension", () => {
    expect(resolveLink("Welcome.md", "Concepts.md", index)).toBe("Welcome.md");
  });

  it("resolves by basename (shortest path)", () => {
    expect(resolveLink("Project Alpha", "Welcome.md", index)).toBe(
      "Projects/Project Alpha.md",
    );
  });

  it("resolves with heading fragment", () => {
    expect(resolveLink("Concepts#Backlinks", "Welcome.md", index)).toBe(
      "Concepts.md",
    );
  });

  it("resolves by alias", () => {
    expect(resolveLink("Home", "Concepts.md", index)).toBe("Welcome.md");
  });

  it("resolves by alias case-insensitive", () => {
    expect(resolveLink("home", "Concepts.md", index)).toBe("Welcome.md");
  });

  it("resolves alias Alpha to Project Alpha", () => {
    expect(resolveLink("Alpha", "Welcome.md", index)).toBe(
      "Projects/Project Alpha.md",
    );
  });

  it("returns null for non-existent target", () => {
    expect(resolveLink("Non Existent Note", "Welcome.md", index)).toBeNull();
  });

  it("resolves full path with folder", () => {
    expect(resolveLink("Projects/Project Alpha", "Welcome.md", index)).toBe(
      "Projects/Project Alpha.md",
    );
  });
});
