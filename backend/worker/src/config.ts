import { existsSync } from "node:fs";
import { resolve } from "node:path";

import dotenv from "dotenv";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z
    .string()
    .url()
    .default("postgresql://mach:mach_local_only@localhost:5432/mach_learning?schema=public"),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  STORAGE_PROVIDER: z.literal("local").default("local"),
  STORAGE_LOCAL_PATH: z.string().trim().min(1).default("./uploads"),
  DOCUMENT_EXTRACTED_TEXT_MAX_CHARACTERS: z.coerce
    .number()
    .int()
    .min(1_000)
    .max(1_000_000)
    .default(100_000),
  DOCUMENT_TARGET_QUESTION_COUNT: z.coerce.number().int().min(1).max(20).default(3),
  AI_PROVIDER: z.literal("mock").default("mock"),
});

export type WorkerConfig = z.infer<typeof schema>;

export function parseWorkerConfig(source: NodeJS.ProcessEnv): WorkerConfig {
  const result = schema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid worker environment: ${issues}`);
  }
  return result.data;
}

export function loadWorkerConfig(cwd = process.cwd()): WorkerConfig {
  for (const path of [resolve(cwd, ".env"), resolve(cwd, "../../.env")]) {
    if (existsSync(path)) {
      dotenv.config({ path, quiet: true });
      break;
    }
  }

  return parseWorkerConfig(process.env);
}
