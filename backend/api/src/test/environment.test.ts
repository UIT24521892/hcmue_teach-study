import { describe, expect, it } from "vitest";

import {
  LOCAL_TEST_DATABASE_URL,
  requireDedicatedTestDatabaseUrl,
  resolveTestDatabaseUrl,
} from "./environment.js";

describe("requireDedicatedTestDatabaseUrl", () => {
  it("accepts only the dedicated mach_test PostgreSQL database", () => {
    expect(requireDedicatedTestDatabaseUrl(LOCAL_TEST_DATABASE_URL)).toBe(LOCAL_TEST_DATABASE_URL);
    expect(
      requireDedicatedTestDatabaseUrl(
        "postgresql://postgres:postgres@localhost:5432/mach_test?schema=public",
      ),
    ).toContain("/mach_test");
  });

  it.each(["mach_learning", "contest", "prod_test_backup", "test"])(
    "rejects the non-dedicated database %s",
    (databaseName) => {
      expect(() =>
        requireDedicatedTestDatabaseUrl(
          `postgresql://postgres:postgres@localhost:5432/${databaseName}?schema=public`,
        ),
      ).toThrow('dedicated "mach_test" database');
    },
  );

  it("rejects malformed URLs and non-PostgreSQL protocols", () => {
    expect(() => requireDedicatedTestDatabaseUrl("not-a-url")).toThrow("valid PostgreSQL URL");
    expect(() => requireDedicatedTestDatabaseUrl("mysql://localhost:3306/mach_test")).toThrow(
      'dedicated "mach_test" database',
    );
  });

  it("never inherits DATABASE_URL when TEST_DATABASE_URL is absent", () => {
    expect(
      resolveTestDatabaseUrl({
        DATABASE_URL: "postgresql://mach:secret@localhost:5432/mach_learning",
      }),
    ).toBe(LOCAL_TEST_DATABASE_URL);
  });
});
