import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import session from "@fastify/session";
import { resolve, join } from "node:path";
import { readFile, access } from "node:fs/promises";
import { vaultRoutes } from "./routes/vault.js";
import { authRoutes, requireAuth } from "./auth.js";

const VAULT_ROOT =
  process.env.VAULT_ROOT ??
  resolve(import.meta.dirname, "../../../fixtures/test-vault");

const DATA_DIR =
  process.env.DATA_DIR ??
  resolve(import.meta.dirname, "../../../data");

const AUTH_ENABLED = process.env.AUTH_ENABLED !== "false";

const app = Fastify({ logger: true, bodyLimit: 10 * 1024 * 1024 });

// Parse binary content types as raw Buffer
app.addContentTypeParser(
  ["application/octet-stream", "image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"],
  { parseAs: "buffer" },
  (_req, body, done) => done(null, body),
);

await app.register(cors, {
  origin: true,
  credentials: true,
});

await app.register(cookie);
await app.register(session, {
  secret: process.env.SESSION_SECRET ?? "obsidian-web-dev-secret-change-in-production",
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
});

app.decorate("vaultRoot", VAULT_ROOT);
app.decorate("dataDir", DATA_DIR);

app.get("/api/health", async () => {
  return { status: "ok", vaultRoot: VAULT_ROOT, authEnabled: AUTH_ENABLED };
});

// Auth routes (always available)
await app.register(authRoutes, { prefix: "/api/auth" });

// Public share route (no auth required)
app.get<{ Params: { id: string } }>("/share/:id", async (request, reply) => {
  const { id } = request.params;
  const sharedFile = join(VAULT_ROOT, ".obsidian", "shared.json");
  try {
    await access(sharedFile);
    const shared = JSON.parse(await readFile(sharedFile, "utf8"));
    const entry = shared[id];
    if (!entry) return reply.status(404).send({ error: "not found" });
    const content = await readFile(join(VAULT_ROOT, entry.path), "utf8");
    const name = entry.path.replace(/\.md$/, "").split("/").pop() ?? entry.path;
    return { name, content, path: entry.path };
  } catch {
    return reply.status(404).send({ error: "not found" });
  }
});

// Vault routes (optionally protected)
if (AUTH_ENABLED) {
  await app.register(async (protectedApp) => {
    protectedApp.addHook("onRequest", requireAuth);
    await protectedApp.register(vaultRoutes, { prefix: "/api/vault" });
  });
} else {
  await app.register(vaultRoutes, { prefix: "/api/vault" });
}

try {
  await app.listen({ port: 3000, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
