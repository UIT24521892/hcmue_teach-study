import { existsSync } from "node:fs";
import { resolve } from "node:path";

import dotenv from "dotenv";
import { z } from "zod";

/**
 * Development-only signing key. Production must provide its own value through
 * the environment; `parseEnv` refuses to fall back when NODE_ENV is production.
 */
const DEVELOPMENT_ACCESS_TOKEN_SECRET = "mach-local-development-access-token-secret";

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    API_PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
    WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
    DATABASE_URL: z.string().url(),
    AUTH_ACCESS_TOKEN_SECRET: z.string().min(32),
    AUTH_ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(86_400).default(900),
    AUTH_REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
    AUTH_COOKIE_NAME: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[A-Za-z0-9_-]+$/, "Tên cookie chỉ gồm chữ, số, gạch ngang hoặc gạch dưới.")
      .default("mach_refresh"),
    STORAGE_PROVIDER: z.literal("local").default("local"),
    STORAGE_LOCAL_PATH: z.string().trim().min(1).default("./uploads"),
    DOCUMENT_UPLOAD_MAX_BYTES: z.coerce
      .number()
      .int()
      .min(1_024)
      .max(50 * 1_024 * 1_024)
      .default(10 * 1_024 * 1_024),
    DOCUMENT_EXTRACTED_TEXT_MAX_CHARACTERS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(1_000_000)
      .default(100_000),
    DOCUMENT_JOB_MODE: z.enum(["inline", "redis"]).default("inline"),
    DOCUMENT_JOB_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(3),
    DOCUMENT_JOB_BACKOFF_MS: z.coerce.number().int().min(100).max(60_000).default(1_000),
    DOCUMENT_AI_DAILY_QUOTA: z.coerce.number().int().min(1).max(1_000).default(20),
    DOCUMENT_TARGET_QUESTION_COUNT: z.coerce.number().int().min(1).max(20).default(3),
    REDIS_URL: z.string().url().default("redis://localhost:6379"),
    AI_PROVIDER: z.literal("mock").default("mock"),
  })
  .superRefine((env, context) => {
    if (env.NODE_ENV === "production" && env.DOCUMENT_JOB_MODE !== "redis") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["DOCUMENT_JOB_MODE"],
        message: "Production phải dùng redis để tác vụ dài không chạy trong API process.",
      });
    }
  });

export type ApiEnv = z.infer<typeof envSchema>;

function defaultDatabaseUrl(nodeEnvironment: string): string | undefined {
  if (nodeEnvironment === "production") {
    return undefined;
  }

  // Tests never touch the development database, so a local `db:seed` run is
  // never wiped by a test suite.
  return nodeEnvironment === "test"
    ? "postgresql://mach:mach_local_only@localhost:5432/mach_test?schema=public"
    : "postgresql://mach:mach_local_only@localhost:5432/mach_learning?schema=public";
}

export function parseEnv(source: NodeJS.ProcessEnv): ApiEnv {
  const nodeEnvironment = source.NODE_ENV ?? "development";
  const withDevelopmentDefaults = {
    ...source,
    DATABASE_URL: source.DATABASE_URL ?? defaultDatabaseUrl(nodeEnvironment),
    AUTH_ACCESS_TOKEN_SECRET:
      source.AUTH_ACCESS_TOKEN_SECRET ??
      (nodeEnvironment === "production" ? undefined : DEVELOPMENT_ACCESS_TOKEN_SECRET),
  };

  const result = envSchema.safeParse(withDevelopmentDefaults);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid API environment: ${issues}`);
  }

  return result.data;
}

export function loadEnvFiles(cwd = process.cwd()): void {
  const candidates = [resolve(cwd, ".env"), resolve(cwd, "../../.env")];
  for (const path of candidates) {
    if (existsSync(path)) {
      dotenv.config({ path, quiet: true });
      return;
    }
  }
}
