import { tmpdir } from "node:os";
import { join } from "node:path";

import { createApp } from "../app.js";
import type { AppConfig } from "../config/app-config.js";

export const TEST_ACCESS_TOKEN_SECRET = "mach-test-access-token-secret-0123456789";

/** Rate limits are effectively disabled so tests exercise behaviour, not quotas. */
const TEST_RATE_LIMIT = { windowMs: 60_000, max: 10_000 };
export const TEST_STORAGE_PATH = join(tmpdir(), `mach-api-upload-tests-${process.pid}`);

export function testAppConfig(overrides: Partial<AppConfig["auth"]> = {}): AppConfig {
  return {
    webOrigin: "http://localhost:5173",
    auth: {
      accessTokenSecret: TEST_ACCESS_TOKEN_SECRET,
      accessTokenTtlSeconds: 900,
      refreshTokenTtlDays: 30,
      cookieName: "mach_refresh",
      cookieSecure: false,
      passwordHashRounds: 4,
      credentialRateLimit: TEST_RATE_LIMIT,
      refreshRateLimit: TEST_RATE_LIMIT,
      ...overrides,
    },
    documents: {
      localStoragePath: TEST_STORAGE_PATH,
      maxUploadBytes: 1_024 * 1_024,
      maxExtractedCharacters: 10_000,
      jobMode: "manual",
      redisUrl: "redis://localhost:6379",
      jobMaxAttempts: 3,
      jobBackoffMs: 10,
      dailyAiQuota: 100,
      targetQuestionCount: 3,
      uploadRateLimit: TEST_RATE_LIMIT,
      aiRateLimit: TEST_RATE_LIMIT,
    },
  };
}

export function createTestApp(overrides: Partial<AppConfig["auth"]> = {}) {
  return createApp(testAppConfig(overrides));
}
