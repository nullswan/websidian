import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import {
  loadVaultConfig,
  scanVault,
  flattenFiles,
  indexVault,
} from "../vault.js";
import { resolveLink } from "../resolver.js";

const FIXTURE_ROOT = resolve(
  import.meta.dirname,
  "../../../../fixtures/test-vault",
);

describe("fixture vault integration", () => {
  it("loads vault config", async () => {
    const config = await loadVaultConfig(FIXTURE_ROOT);
    expect(config.name).toBe("test-vault");
    expect(config.attachmentFolder).toBe("Attachments");
  });

  it("scans vault file tree", async () => {
    const tree = await scanVault(FIXTURE_ROOT);
    const files = flattenFiles(tree);
    const paths = files.map((f) => f.path);

    expect(paths).toContain("Welcome.md");
    expect(paths).toContain("Concepts.md");
    expect(paths).toContain("Projects/Project Alpha.md");
    expect(paths).toContain("Daily Notes/2026-04-04.md");
    expect(paths).toContain("Canvas Example.canvas");
    expect(paths).toContain("Attachments/diagram.png");
  });

  it("indexes vault and resolves links", async () => {
    const tree = await scanVault(FIXTURE_ROOT);
    const files = flattenFiles(tree);
    const { notes, index } = await indexVault(FIXTURE_ROOT, files);

    // Should have parsed all .md files
    expect(notes.length).toBe(5);

    // Welcome.md should have aliases
    const welcome = notes.find((n) => n.path === "Welcome.md");
    expect(welcome?.aliases).toContain("Home");

    // Resolve links from Welcome.md
    expect(resolveLink("Project Alpha", "Welcome.md", index)).toBe(
      "Projects/Project Alpha.md",
    );
    expect(resolveLink("Concepts#Backlinks", "Welcome.md", index)).toBe(
      "Concepts.md",
    );
    expect(resolveLink("Home", "Concepts.md", index)).toBe("Welcome.md");

    // Check that Welcome.md has expected links
    expect(welcome?.links.length).toBeGreaterThanOrEqual(5);
    expect(welcome?.embeds.length).toBeGreaterThanOrEqual(1);
  });
});
