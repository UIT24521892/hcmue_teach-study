import { describe, expect, it } from "vitest";

import { parseEnv } from "./env.js";

describe("parseEnv", () => {
  it("provides safe local defaults", () => {
    const env = parseEnv({ NODE_ENV: "development" });

    expect(env.API_PORT).toBe(4000);
    expect(env.DATABASE_URL).toContain("mach_learning");
    expect(env.AUTH_COOKIE_NAME).toBe("mach_refresh");
    expect(env.AUTH_ACCESS_TOKEN_TTL_SECONDS).toBe(900);
    expect(env.AUTH_REFRESH_TOKEN_TTL_DAYS).toBe(30);
    expect(env.STORAGE_PROVIDER).toBe("local");
    expect(env.STORAGE_LOCAL_PATH).toBe("./uploads");
    expect(env.DOCUMENT_UPLOAD_MAX_BYTES).toBe(10 * 1_024 * 1_024);
    expect(env.AUTH_ACCESS_TOKEN_SECRET.length).toBeGreaterThanOrEqual(32);
  });

  it("keeps tests away from the development database", () => {
    expect(parseEnv({ NODE_ENV: "test" }).DATABASE_URL).toContain("mach_test");
  });

  it("requires a database URL in production", () => {
    expect(() => parseEnv({ NODE_ENV: "production" })).toThrow("Invalid API environment");
  });

  it("requires a real access token secret in production", () => {
    expect(() =>
      parseEnv({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/mach",
      }),
    ).toThrow("AUTH_ACCESS_TOKEN_SECRET");
  });

  it("requires the Redis queue instead of inline work in production", () => {
    expect(() =>
      parseEnv({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/mach",
        AUTH_ACCESS_TOKEN_SECRET: "production-access-token-secret-123456",
        DOCUMENT_JOB_MODE: "inline",
      }),
    ).toThrow("DOCUMENT_JOB_MODE");
  });

  it("rejects a short access token secret", () => {
    expect(() =>
      parseEnv({
        NODE_ENV: "test",
        DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/mach_test",
        AUTH_ACCESS_TOKEN_SECRET: "too-short",
      }),
    ).toThrow("Invalid API environment");
  });

  it("rejects an invalid port", () => {
    expect(() =>
      parseEnv({
        NODE_ENV: "test",
        API_PORT: "70000",
        DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/test",
      }),
    ).toThrow("Invalid API environment");
  });

  it("rejects unsupported storage and unsafe upload limits", () => {
    expect(() => parseEnv({ NODE_ENV: "test", STORAGE_PROVIDER: "public-folder" })).toThrow(
      "STORAGE_PROVIDER",
    );
    expect(() => parseEnv({ NODE_ENV: "test", DOCUMENT_UPLOAD_MAX_BYTES: "100" })).toThrow(
      "DOCUMENT_UPLOAD_MAX_BYTES",
    );
  });
});
