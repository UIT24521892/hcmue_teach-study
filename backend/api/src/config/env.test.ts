import { describe, expect, it } from "vitest";

import { parseEnv } from "./env.js";

describe("parseEnv", () => {
  it("provides safe local defaults", () => {
    const env = parseEnv({ NODE_ENV: "development" });

    expect(env.API_PORT).toBe(4000);
    expect(env.DATABASE_URL).toContain("mach_learning");
  });

  it("requires a database URL in production", () => {
    expect(() => parseEnv({ NODE_ENV: "production" })).toThrow("Invalid API environment");
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
});
