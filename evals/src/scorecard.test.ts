import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { resolve } from "node:path";
import {
  loadVaultConfig,
  scanVault,
  flattenFiles,
  indexVault,
  resolveLink,
  parseFrontmatter,
  extractAliases,
  extractFrontmatterTags,
  parseNote,
} from "@obsidian-web/vault-core";
import { readFile } from "node:fs/promises";

const VAULT_ROOT = resolve(import.meta.dirname, "../../fixtures/test-vault");

// ─── Eval 1: Vault Loading ───────────────────────────────────────────

describe("EVAL: Vault Loading", () => {
  it("loads vault config with correct attachment folder", async () => {
    const config = await loadVaultConfig(VAULT_ROOT);
    expect(config.attachmentFolder).toBe("Attachments");
  });

  it("discovers all expected files", async () => {
    const tree = await scanVault(VAULT_ROOT);
    const files = flattenFiles(tree);
    const paths = files.map((f) => f.path).sort();

    expect(paths).toContain("Welcome.md");
    expect(paths).toContain("Concepts.md");
    expect(paths).toContain("Projects/Project Alpha.md");
    expect(paths).toContain("Projects/Project Beta.md");
    expect(paths).toContain("Daily Notes/2026-04-04.md");
    expect(paths).toContain("Canvas Example.canvas");
    expect(paths).toContain("Attachments/diagram.png");
  });

  it("excludes .obsidian from file tree", async () => {
    const tree = await scanVault(VAULT_ROOT);
    const files = flattenFiles(tree);
    const obsPaths = files.filter((f) => f.path.startsWith(".obsidian"));
    expect(obsPaths).toHaveLength(0);
  });
});

// ─── Eval 2: Frontmatter Parsing ─────────────────────────────────────

describe("EVAL: Frontmatter Parsing", () => {
  it("parses aliases from Welcome.md", async () => {
    const content = await readFile(resolve(VAULT_ROOT, "Welcome.md"), "utf-8");
    const { frontmatter } = parseFrontmatter(content);
    const aliases = extractAliases(frontmatter);
    expect(aliases).toContain("Home");
    expect(aliases).toContain("Start Here");
  });

  it("parses tags from frontmatter", async () => {
    const content = await readFile(resolve(VAULT_ROOT, "Welcome.md"), "utf-8");
    const { frontmatter } = parseFrontmatter(content);
    const tags = extractFrontmatterTags(frontmatter);
    expect(tags).toContain("meta");
    expect(tags).toContain("welcome");
  });

  it("parses custom properties", async () => {
    const content = await readFile(
      resolve(VAULT_ROOT, "Projects/Project Alpha.md"),
      "utf-8",
    );
    const { frontmatter } = parseFrontmatter(content);
    expect(frontmatter.status).toBe("active");
    expect(frontmatter.priority).toBe("high");
  });
});

// ─── Eval 3: Link Resolution ─────────────────────────────────────────

describe("EVAL: Link Resolution", () => {
  let index: Awaited<ReturnType<typeof indexVault>>["index"];

  beforeAll(async () => {
    const tree = await scanVault(VAULT_ROOT);
    const files = flattenFiles(tree);
    const result = await indexVault(VAULT_ROOT, files);
    index = result.index;
  });

  it("resolves exact filename", () => {
    expect(resolveLink("Welcome", "Concepts.md", index)).toBe("Welcome.md");
  });

  it("resolves with .md extension", () => {
    expect(resolveLink("Welcome.md", "Concepts.md", index)).toBe("Welcome.md");
  });

  it("resolves by shortest path (basename)", () => {
    expect(resolveLink("Project Alpha", "Welcome.md", index)).toBe(
      "Projects/Project Alpha.md",
    );
  });

  it("resolves full path with folder", () => {
    expect(resolveLink("Projects/Project Alpha", "Welcome.md", index)).toBe(
      "Projects/Project Alpha.md",
    );
  });

  it("resolves with heading fragment", () => {
    expect(resolveLink("Concepts#Backlinks", "Welcome.md", index)).toBe(
      "Concepts.md",
    );
  });

  it("resolves by alias (case-insensitive)", () => {
    expect(resolveLink("Home", "Concepts.md", index)).toBe("Welcome.md");
    expect(resolveLink("home", "Concepts.md", index)).toBe("Welcome.md");
  });

  it("resolves alias Alpha", () => {
    expect(resolveLink("Alpha", "Welcome.md", index)).toBe(
      "Projects/Project Alpha.md",
    );
  });

  it("returns null for non-existent link", () => {
    expect(resolveLink("Does Not Exist", "Welcome.md", index)).toBeNull();
  });
});

// ─── Eval 4: Note Parsing ────────────────────────────────────────────

describe("EVAL: Note Parsing", () => {
  it("extracts wikilinks from Welcome.md", async () => {
    const content = await readFile(resolve(VAULT_ROOT, "Welcome.md"), "utf-8");
    const meta = parseNote("Welcome.md", content);
    const targets = meta.links.map((l) => l.target);

    expect(targets).toContain("Projects/Project Alpha");
    expect(targets).toContain("Daily Notes/2026-04-04");
    expect(targets).toContain("Concepts");
    expect(targets).toContain("Project Alpha");
    expect(targets).toContain("Concepts#Backlinks");
  });

  it("extracts display text from aliased links", async () => {
    const content = await readFile(resolve(VAULT_ROOT, "Welcome.md"), "utf-8");
    const meta = parseNote("Welcome.md", content);
    const aliasedLink = meta.links.find((l) => l.display === "My Concepts");
    expect(aliasedLink).toBeDefined();
    expect(aliasedLink!.target).toBe("Concepts");
  });

  it("extracts embeds", async () => {
    const content = await readFile(resolve(VAULT_ROOT, "Welcome.md"), "utf-8");
    const meta = parseNote("Welcome.md", content);
    const embedTargets = meta.embeds.map((e) => e.target);
    expect(embedTargets).toContain("Attachments/diagram.png");
    expect(embedTargets).toContain("Concepts#Tags");
  });

  it("extracts inline tags", async () => {
    const content = await readFile(resolve(VAULT_ROOT, "Welcome.md"), "utf-8");
    const meta = parseNote("Welcome.md", content);
    const tagNames = meta.tags.map((t) => t.name);
    expect(tagNames).toContain("welcome");
    expect(tagNames).toContain("meta");
    expect(tagNames).toContain("test");
    expect(tagNames).toContain("nested/tag");
  });
});

// ─── Eval 5: Backlink Detection ──────────────────────────────────────

describe("EVAL: Backlink Detection", () => {
  it("finds notes that link to Welcome.md", async () => {
    const tree = await scanVault(VAULT_ROOT);
    const files = flattenFiles(tree);
    const { notes, index } = await indexVault(VAULT_ROOT, files);

    const backlinks: string[] = [];
    for (const note of notes) {
      if (note.path === "Welcome.md") continue;
      for (const link of note.links) {
        const resolved = resolveLink(link.target, note.path, index);
        if (resolved === "Welcome.md") {
          backlinks.push(note.path);
          break;
        }
      }
    }

    expect(backlinks).toContain("Concepts.md");
    expect(backlinks).toContain("Projects/Project Alpha.md");
    expect(backlinks).toContain("Projects/Project Beta.md");
  });
});

// ─── Scorecard Summary ───────────────────────────────────────────────

afterAll(() => {
  // This runs after all tests. The pass/fail count is the scorecard.
  console.log("\n═══ EVAL SCORECARD ═══");
  console.log("Run `pnpm --filter @obsidian-web/evals eval` to see results.");
  console.log("Each passing test is a fidelity checkpoint.");
  console.log("═════════════════════\n");
});
