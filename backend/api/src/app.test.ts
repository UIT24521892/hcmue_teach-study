import request from "supertest";
import { describe, expect, it } from "vitest";

import { healthStatusSchema } from "@mach/contracts";

import { createApp } from "./app.js";

const app = createApp({ webOrigin: "http://localhost:5173" });

describe("health endpoints", () => {
  it("returns the versioned health contract", async () => {
    const response = await request(app).get("/api/v1/health").expect(200);

    expect(healthStatusSchema.parse(response.body).status).toBe("ok");
    expect(response.headers["x-request-id"]).toBeTypeOf("string");
  });

  it("returns a consistent not-found error", async () => {
    const response = await request(app).get("/api/v1/missing").expect(404);

    expect(response.body).toMatchObject({
      code: "NOT_FOUND",
      requestId: response.headers["x-request-id"],
    });
  });
});
