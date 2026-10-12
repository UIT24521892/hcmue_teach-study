import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { prepareTestEnvironment, testDatabaseUrl } from "./environment.js";

const packageRoot = fileURLToPath(new URL("../..", import.meta.url));
const repositoryRoot = resolve(packageRoot, "../..");
const prismaSchema = resolve(repositoryRoot, "backend/prisma/schema.prisma");
const prismaCli = resolve(repositoryRoot, "node_modules/prisma/build/index.js");

/**
 * Applies pending migrations to the test database once per run, so a fresh
 * clone can run `npm test` without a separate manual step. CI already runs
 * `db:deploy`, which makes this call a no-op there.
 */
export default function globalSetup(): void {
  prepareTestEnvironment();

  if (!existsSync(prismaCli)) {
    throw new Error(`Prisma CLI not found at ${prismaCli}. Run npm install first.`);
  }

  execFileSync(process.execPath, [prismaCli, "migrate", "deploy", "--schema", prismaSchema], {
    env: { ...process.env, DATABASE_URL: testDatabaseUrl() },
    stdio: "pipe",
  });
}
