import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import bcrypt from "bcryptjs";

interface User {
  username: string;
  passwordHash: string;
  createdAt: string;
}

interface UsersStore {
  users: User[];
}

function getUsersPath(dataDir: string): string {
  return join(dataDir, "users.json");
}

async function loadUsers(dataDir: string): Promise<UsersStore> {
  try {
    const raw = await readFile(getUsersPath(dataDir), "utf-8");
    return JSON.parse(raw);
  } catch {
    return { users: [] };
  }
}

async function saveUsers(dataDir: string, store: UsersStore): Promise<void> {
  const path = getUsersPath(dataDir);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(store, null, 2), "utf-8");
}

export async function authRoutes(app: FastifyInstance) {
  const dataDir = (app as any).dataDir as string;

  // POST /api/auth/register
  app.post<{ Body: { username: string; password: string } }>(
    "/register",
    async (request, reply) => {
      const { username, password } = request.body ?? {};
      if (!username || !password) {
        return reply.status(400).send({ error: "username and password required" });
      }
      if (username.length < 2 || password.length < 4) {
        return reply.status(400).send({ error: "username min 2 chars, password min 4 chars" });
      }

      const store = await loadUsers(dataDir);
      if (store.users.some((u) => u.username === username)) {
        return reply.status(409).send({ error: "username already exists" });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      store.users.push({
        username,
        passwordHash,
        createdAt: new Date().toISOString(),
      });
      await saveUsers(dataDir, store);

      (request.session as any).user = username;
      return { username, registered: true };
    },
  );

  // POST /api/auth/login
  app.post<{ Body: { username: string; password: string } }>(
    "/login",
    async (request, reply) => {
      const { username, password } = request.body ?? {};
      if (!username || !password) {
        return reply.status(400).send({ error: "username and password required" });
      }

      const store = await loadUsers(dataDir);
      const user = store.users.find((u) => u.username === username);
      if (!user) {
        return reply.status(401).send({ error: "invalid credentials" });
      }

      const match = await bcrypt.compare(password, user.passwordHash);
      if (!match) {
        return reply.status(401).send({ error: "invalid credentials" });
      }

      (request.session as any).user = username;
      return { username, loggedIn: true };
    },
  );

  // POST /api/auth/logout
  app.post("/logout", async (request) => {
    request.session.destroy();
    return { loggedOut: true };
  });

  // GET /api/auth/me — current session
  app.get("/me", async (request) => {
    const user = (request.session as any).user;
    if (!user) {
      return { authenticated: false };
    }
    return { authenticated: true, username: user };
  });
}

// Middleware to require auth on vault routes
export function requireAuth(request: FastifyRequest, reply: FastifyReply, done: () => void) {
  const user = (request.session as any)?.user;
  if (!user) {
    reply.status(401).send({ error: "authentication required" });
    return;
  }
  done();
}
