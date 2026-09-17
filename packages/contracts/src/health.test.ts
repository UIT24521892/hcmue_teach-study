import { describe, expect, it } from "vitest";

import { healthStatusSchema } from "./health.js";

describe("healthStatusSchema", () => {
  it("accepts the public health contract", () => {
    const result = healthStatusSchema.safeParse({
      status: "ok",
      service: "api",
      version: "0.1.0",
      timestamp: new Date().toISOString(),
      uptimeSeconds: 1,
    });

    expect(result.success).toBe(true);
  });

  it("rejects an unknown status", () => {
    expect(
      healthStatusSchema.safeParse({
        status: "degraded",
        service: "api",
        version: "0.1.0",
        timestamp: new Date().toISOString(),
        uptimeSeconds: 1,
      }).success,
    ).toBe(false);
  });
});
