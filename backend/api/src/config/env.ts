import { existsSync } from "node:fs";
import { resolve } from "node:path";

import dotenv from "dotenv";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
  DATABASE_URL: z.string().url(),
});

export type ApiEnv = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv): ApiEnv {
  const nodeEnvironment = source.NODE_ENV ?? "development";
  const withDevelopmentDefaults = {
    ...source,
    DATABASE_URL:
      source.DATABASE_URL ??
      (nodeEnvironment === "production"
        ? undefined
        : "postgresql://mach:mach_local_only@localhost:5432/mach_learning?schema=public"),
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
