import { loadEnvFiles } from "../config/env.js";

export const LOCAL_TEST_DATABASE_URL =
  "postgresql://mach:mach_local_only@localhost:5432/mach_test?schema=public";

export function requireDedicatedTestDatabaseUrl(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("TEST_DATABASE_URL must be a valid PostgreSQL URL.");
  }

  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!["postgresql:", "postgres:"].includes(parsed.protocol) || databaseName !== "mach_test") {
    throw new Error(
      `Refusing to run API tests against database "${databaseName || "unknown"}": TEST_DATABASE_URL must target the dedicated "mach_test" database.`,
    );
  }

  return value;
}

export function resolveTestDatabaseUrl(source: NodeJS.ProcessEnv): string {
  return requireDedicatedTestDatabaseUrl(source.TEST_DATABASE_URL ?? LOCAL_TEST_DATABASE_URL);
}

/**
 * Prepares `process.env` before any module (including the Prisma client
 * singleton) is imported.
 *
 * `DATABASE_URL` is deliberately ignored here. Tests only use TEST_DATABASE_URL
 * (or the fixed local mach_test default), so an exported development URL cannot
 * be inherited by a destructive integration suite.
 */
export function prepareTestEnvironment(): void {
  process.env.NODE_ENV = "test";
  loadEnvFiles();
  process.env.DATABASE_URL = resolveTestDatabaseUrl(process.env);
}

export function testDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to run API tests.");
  }

  return databaseUrl;
}
