import { describe, expect, it } from "vitest";

import {
  authSessionSchema,
  authUserSchema,
  loginRequestSchema,
  registerRequestSchema,
  selfRegisterableRoleSchema,
  timezoneSchema,
} from "./auth.js";
import { errorCodeSchema, errorResponseSchema } from "./errors.js";

describe("registerRequestSchema", () => {
  const valid = {
    name: "  Lê Chi  ",
    email: "  Chi@Example.COM ",
    password: "matkhau-rat-dai-123",
    role: "self_learner",
  };

  it("trims and lower-cases the identity fields", () => {
    const parsed = registerRequestSchema.parse(valid);

    expect(parsed.name).toBe("Lê Chi");
    expect(parsed.email).toBe("chi@example.com");
  });

  it("accepts every self-registerable role", () => {
    for (const role of ["teacher", "student", "self_learner"]) {
      expect(registerRequestSchema.safeParse({ ...valid, role }).success).toBe(true);
    }
  });

  it("refuses the admin role", () => {
    expect(registerRequestSchema.safeParse({ ...valid, role: "admin" }).success).toBe(false);
    expect(selfRegisterableRoleSchema.safeParse("admin").success).toBe(false);
  });

  it("enforces a minimum password length", () => {
    expect(registerRequestSchema.safeParse({ ...valid, password: "ngan" }).success).toBe(false);
  });

  it("rejects a malformed email and an unknown role", () => {
    expect(registerRequestSchema.safeParse({ ...valid, email: "khong-phai-email" }).success).toBe(
      false,
    );
    expect(registerRequestSchema.safeParse({ ...valid, role: "principal" }).success).toBe(false);
  });

  it("accepts an optional IANA timezone and rejects a loose string", () => {
    expect(timezoneSchema.safeParse("Asia/Ho_Chi_Minh").success).toBe(true);
    expect(timezoneSchema.safeParse("UTC").success).toBe(true);
    expect(timezoneSchema.safeParse("Asia/Ho Chi Minh").success).toBe(false);
    expect(
      registerRequestSchema.safeParse({ ...valid, timezone: "Asia/Ho_Chi_Minh" }).success,
    ).toBe(true);
  });
});

describe("loginRequestSchema", () => {
  it("requires a non-empty password but does not enforce the register rules", () => {
    expect(loginRequestSchema.safeParse({ email: "chi@example.com", password: "x" }).success).toBe(
      true,
    );
    expect(loginRequestSchema.safeParse({ email: "chi@example.com", password: "" }).success).toBe(
      false,
    );
  });
});

describe("auth response contracts", () => {
  it("accepts a session without any token material inside the user", () => {
    const parsed = authSessionSchema.safeParse({
      user: {
        id: "user_1",
        name: "Lê Chi",
        email: "chi@example.com",
        role: "self_learner",
        timezone: "Asia/Ho_Chi_Minh",
        createdAt: new Date().toISOString(),
      },
      accessToken: "header.payload.signature",
      accessTokenExpiresAt: new Date().toISOString(),
    });

    expect(parsed.success).toBe(true);
  });

  it("strips any unexpected field such as a password hash", () => {
    const parsed = authUserSchema.parse({
      id: "user_1",
      name: "Lê Chi",
      email: "chi@example.com",
      role: "self_learner",
      timezone: "Asia/Ho_Chi_Minh",
      createdAt: new Date().toISOString(),
      passwordHash: "$2b$12$abcdefghijklmnopqrstuv",
    });

    // Parsing through the contract is the last line of defence: even if a
    // service accidentally selects the hash, it cannot reach the client.
    expect(parsed).not.toHaveProperty("passwordHash");
  });
});

describe("errorResponseSchema", () => {
  it("accepts the shared error envelope with and without details", () => {
    expect(
      errorResponseSchema.safeParse({
        code: "VALIDATION_ERROR",
        message: "Dữ liệu gửi lên không hợp lệ.",
        details: { email: ["Email không hợp lệ."] },
        requestId: "req_1",
      }).success,
    ).toBe(true);

    expect(
      errorResponseSchema.safeParse({
        code: "NOT_FOUND",
        message: "Không tìm thấy.",
        requestId: "req_2",
      }).success,
    ).toBe(true);
  });

  it("rejects an unknown code", () => {
    expect(
      errorResponseSchema.safeParse({
        code: "TEAPOT",
        message: "…",
        requestId: "req_3",
      }).success,
    ).toBe(false);
    expect(errorCodeSchema.options).toContain("RATE_LIMITED");
    expect(errorCodeSchema.options).toContain("SESSION_REFRESH_CONFLICT");
  });
});
