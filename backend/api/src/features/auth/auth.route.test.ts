import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { UserRole } from "@prisma/client";

import { authSessionSchema, errorResponseSchema } from "@mach/contracts";

import { prisma } from "../../lib/prisma.js";
import { createTestApp } from "../../test/app.js";
import { countActiveRefreshTokens, resetAuthTables } from "../../test/database.js";
import { REFRESH_CONCURRENCY_GRACE_MS } from "./auth.service.js";

const COOKIE_NAME = "mach_refresh";
const app = createTestApp();

const registration = {
  name: "Lê Chi",
  email: "chi@example.com",
  password: "matkhau-rat-dai-123",
  role: "self_learner",
} as const;

function refreshCookieOf(response: request.Response): string {
  const header = response.headers["set-cookie"];
  const cookies = Array.isArray(header) ? header : header ? [header] : [];
  const cookie = cookies.find((value) => value.startsWith(`${COOKIE_NAME}=`));
  if (!cookie) {
    throw new Error("Refresh cookie was not set on the response.");
  }

  return cookie.split(";")[0] ?? "";
}

async function registerAndGetCookie(): Promise<{ cookie: string; accessToken: string }> {
  const response = await request(app).post("/api/v1/auth/register").send(registration).expect(201);
  const session = authSessionSchema.parse(response.body);

  return { cookie: refreshCookieOf(response), accessToken: session.accessToken };
}

beforeEach(async () => {
  await resetAuthTables();
});

describe("POST /api/v1/auth/register", () => {
  it("creates the account, returns a session and hides the password", async () => {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .send({ ...registration, email: "  Chi@Example.COM  " })
      .expect(201);

    const session = authSessionSchema.parse(response.body);
    expect(session.user).toMatchObject({
      email: "chi@example.com",
      name: "Lê Chi",
      role: "self_learner",
      timezone: "Asia/Ho_Chi_Minh",
    });
    expect(JSON.stringify(response.body)).not.toContain(registration.password);
  });

  it("stores a bcrypt hash instead of the plain password", async () => {
    await registerAndGetCookie();

    const stored = await prisma.user.findUniqueOrThrow({ where: { email: registration.email } });
    expect(stored.passwordHash).not.toBe(registration.password);
    expect(stored.passwordHash.startsWith("$2")).toBe(true);
  });

  it("sets an httpOnly refresh cookie scoped to the auth endpoints", async () => {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .send(registration)
      .expect(201);
    const header = response.headers["set-cookie"];

    expect(Array.isArray(header) ? header.join(";") : header).toContain("HttpOnly");
    expect(Array.isArray(header) ? header.join(";") : header).toContain(`Path=/api/v1/auth`);
  });

  it("refuses the admin role through public registration", async () => {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .send({ ...registration, role: "admin" })
      .expect(400);

    expect(errorResponseSchema.parse(response.body).code).toBe("VALIDATION_ERROR");
    expect(await prisma.user.count()).toBe(0);
  });

  it("rejects a weak password and an unknown role", async () => {
    await request(app)
      .post("/api/v1/auth/register")
      .send({ ...registration, password: "short" })
      .expect(400);

    await request(app)
      .post("/api/v1/auth/register")
      .send({ ...registration, role: "principal" })
      .expect(400);

    expect(await prisma.user.count()).toBe(0);
  });

  it("rejects a duplicate email regardless of casing", async () => {
    await request(app).post("/api/v1/auth/register").send(registration).expect(201);

    const response = await request(app)
      .post("/api/v1/auth/register")
      .send({ ...registration, email: "CHI@example.com" })
      .expect(409);

    expect(errorResponseSchema.parse(response.body).code).toBe("CONFLICT");
    expect(await prisma.user.count()).toBe(1);
  });
});

describe("POST /api/v1/auth/login", () => {
  beforeEach(async () => {
    await request(app).post("/api/v1/auth/register").send(registration).expect(201);
  });

  it("returns a session for valid credentials", async () => {
    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: registration.email, password: registration.password })
      .expect(200);

    expect(authSessionSchema.parse(response.body).user.email).toBe(registration.email);
  });

  it("rejects a wrong password without issuing a cookie", async () => {
    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: registration.email, password: "khong-dung-mat-khau" })
      .expect(401);

    expect(errorResponseSchema.parse(response.body).code).toBe("UNAUTHENTICATED");
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("gives the same answer for an unknown email as for a wrong password", async () => {
    const unknown = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "khong-ton-tai@example.com", password: registration.password })
      .expect(401);

    const wrongPassword = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: registration.email, password: "khong-dung-mat-khau" })
      .expect(401);

    // Same status, code and message: the response must not reveal whether the
    // account exists. `requestId` is per-request and therefore differs.
    const { code, message } = errorResponseSchema.parse(unknown.body);
    expect({ code, message }).toEqual({
      code: errorResponseSchema.parse(wrongPassword.body).code,
      message: errorResponseSchema.parse(wrongPassword.body).message,
    });
  });
});

describe("POST /api/v1/auth/refresh", () => {
  it("rotates the refresh token and distinguishes concurrency from replay", async () => {
    const first = await registerAndGetCookie();
    const user = await prisma.user.findUniqueOrThrow({ where: { email: registration.email } });
    const rotated = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", first.cookie)
      .expect(200);

    const secondCookie = refreshCookieOf(rotated);
    expect(secondCookie).not.toBe(first.cookie);
    expect(authSessionSchema.parse(rotated.body).user.email).toBe(registration.email);

    // Immediate reuse can be a second tab. It must not erase the winner's cookie
    // or revoke the family while the browser is still applying Set-Cookie.
    const concurrent = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", first.cookie)
      .expect(409);
    expect(errorResponseSchema.parse(concurrent.body).code).toBe("SESSION_REFRESH_CONFLICT");
    expect(concurrent.headers["set-cookie"]).toBeUndefined();
    await request(app).post("/api/v1/auth/refresh").set("Cookie", secondCookie).expect(200);

    // Once the concurrency grace has elapsed, reuse is treated as replay and
    // revokes every successor in the login family.
    await prisma.refreshToken.updateMany({
      where: { revokedAt: { not: null }, replacedById: { not: null } },
      data: { revokedAt: new Date(Date.now() - REFRESH_CONCURRENCY_GRACE_MS - 1_000) },
    });
    await request(app).post("/api/v1/auth/refresh").set("Cookie", first.cookie).expect(401);

    expect(await countActiveRefreshTokens(user.id)).toBe(0);
    await request(app).post("/api/v1/auth/refresh").set("Cookie", secondCookie).expect(401);
  });

  it("allows only one winner when the same refresh token is used concurrently", async () => {
    for (let iteration = 0; iteration < 20; iteration += 1) {
      await resetAuthTables();
      const { cookie } = await registerAndGetCookie();
      const user = await prisma.user.findUniqueOrThrow({ where: { email: registration.email } });

      const responses = await Promise.all([
        request(app).post("/api/v1/auth/refresh").set("Cookie", cookie),
        request(app).post("/api/v1/auth/refresh").set("Cookie", cookie),
      ]);
      const winner = responses.find((response) => response.status === 200);
      const retry = responses.find((response) => response.status === 409);

      expect(winner, `iteration ${iteration + 1}`).toBeDefined();
      expect(retry, `iteration ${iteration + 1}`).toBeDefined();
      expect(errorResponseSchema.parse(retry?.body).code).toBe("SESSION_REFRESH_CONFLICT");
      expect(retry?.headers["set-cookie"]).toBeUndefined();
      expect(await countActiveRefreshTokens(user.id)).toBe(1);

      const winnerCookie = refreshCookieOf(winner!);
      await request(app).post("/api/v1/auth/refresh").set("Cookie", winnerCookie).expect(200);
      expect(await countActiveRefreshTokens(user.id)).toBe(1);
    }
  });

  it("keeps only one live refresh token per login", async () => {
    const { cookie } = await registerAndGetCookie();
    const user = await prisma.user.findUniqueOrThrow({ where: { email: registration.email } });
    expect(await countActiveRefreshTokens(user.id)).toBe(1);

    await request(app).post("/api/v1/auth/refresh").set("Cookie", cookie).expect(200);
    expect(await countActiveRefreshTokens(user.id)).toBe(1);
  });

  it("revokes an expired refresh-token family", async () => {
    const { cookie } = await registerAndGetCookie();
    const user = await prisma.user.findUniqueOrThrow({ where: { email: registration.email } });
    await prisma.refreshToken.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });

    await request(app).post("/api/v1/auth/refresh").set("Cookie", cookie).expect(401);
    expect(await countActiveRefreshTokens(user.id)).toBe(0);
  });

  it("rejects a missing or unknown cookie and clears it", async () => {
    await request(app).post("/api/v1/auth/refresh").expect(401);

    const response = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `${COOKIE_NAME}=khong-phai-token-that`)
      .expect(401);

    expect(errorResponseSchema.parse(response.body).code).toBe("UNAUTHENTICATED");
    const header = response.headers["set-cookie"];
    expect(Array.isArray(header) ? header.join(";") : header).toContain(`${COOKIE_NAME}=;`);
  });

  it("preserves the cookie when refresh fails transiently", async () => {
    const { cookie } = await registerAndGetCookie();
    vi.spyOn(prisma.refreshToken, "findUnique").mockRejectedValueOnce(
      new Error("temporary database failure"),
    );

    const response = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", cookie)
      .expect(500);

    expect(errorResponseSchema.parse(response.body).code).toBe("INTERNAL_ERROR");
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("stops working after the account is soft deleted", async () => {
    const { cookie } = await registerAndGetCookie();
    await prisma.user.update({
      where: { email: registration.email },
      data: { deletedAt: new Date() },
    });

    await request(app).post("/api/v1/auth/refresh").set("Cookie", cookie).expect(401);
  });
});

describe("POST /api/v1/auth/logout", () => {
  it("revokes the session and clears the cookie", async () => {
    const { cookie } = await registerAndGetCookie();

    const response = await request(app)
      .post("/api/v1/auth/logout")
      .set("Cookie", cookie)
      .expect(200);
    expect(response.body).toEqual({ success: true });

    await request(app).post("/api/v1/auth/refresh").set("Cookie", cookie).expect(401);
  });

  it("is idempotent when no cookie is present", async () => {
    await request(app).post("/api/v1/auth/logout").expect(200);
  });
});

describe("GET /api/v1/auth/me", () => {
  it("returns the signed-in user", async () => {
    const { accessToken } = await registerAndGetCookie();

    const response = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toMatchObject({ user: { email: registration.email } });
  });

  it("rejects a missing, malformed or foreign-signed token", async () => {
    await request(app).get("/api/v1/auth/me").expect(401);
    await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", "Bearer abc.def.ghi")
      .expect(401);

    const foreignApp = createTestApp({
      accessTokenSecret: "a-completely-different-secret-value-000",
    });
    const { accessToken } = await registerAndGetCookie();
    await request(foreignApp)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(401);
  });

  it("takes the role from the database, not from the token claim", async () => {
    const { accessToken } = await registerAndGetCookie();
    await prisma.user.update({
      where: { email: registration.email },
      data: { role: UserRole.TEACHER },
    });

    const response = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toMatchObject({ user: { role: "teacher" } });
  });

  it("rejects a still-valid token after the account is soft deleted", async () => {
    const { accessToken } = await registerAndGetCookie();
    await prisma.user.update({
      where: { email: registration.email },
      data: { deletedAt: new Date() },
    });

    await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(401);
  });
});
