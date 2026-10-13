import { PrismaClient } from "@prisma/client";

/**
 * A single client per process. Reused across hot reloads in development so
 * `tsx watch` does not exhaust the PostgreSQL connection pool.
 */
const globalForPrisma = globalThis as unknown as { machPrisma?: PrismaClient };

export const prisma =
  globalForPrisma.machPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.machPrisma = prisma;
}
