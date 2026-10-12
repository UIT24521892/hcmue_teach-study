import { describe, expect, it } from "vitest";

import {
  createAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  verifyAccessToken,
} from "./auth.tokens.js";

const secret = "mach-test-access-token-secret-0123456789";

describe("access tokens", () => {
  it("round-trips the user id and role", async () => {
    const issued = await createAccessToken(
      { userId: "user_123", role: "teacher" },
      { secret, ttlSeconds: 900 },
    );

    expect(await verifyAccessToken(issued.token, { secret })).toEqual({
      userId: "user_123",
      role: "teacher",
    });
    expect(issued.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("rejects a token signed with a different secret", async () => {
    const issued = await createAccessToken(
      { userId: "user_123", role: "student" },
      { secret, ttlSeconds: 900 },
    );

    expect(
      await verifyAccessToken(issued.token, { secret: `${secret}-another-value-0000000` }),
    ).toBeNull();
  });

  it("rejects a tampered payload", async () => {
    const issued = await createAccessToken(
      { userId: "user_123", role: "student" },
      { secret, ttlSeconds: 900 },
    );
    const [header, , signature] = issued.token.split(".");
    const forgedPayload = Buffer.from(
      JSON.stringify({ sub: "user_999", role: "admin", typ: "access" }),
    ).toString("base64url");

    expect(
      await verifyAccessToken(`${header}.${forgedPayload}.${signature}`, { secret }),
    ).toBeNull();
  });

  it("rejects an expired token", async () => {
    const issued = await createAccessToken(
      { userId: "user_123", role: "teacher" },
      { secret, ttlSeconds: -60 },
    );

    expect(await verifyAccessToken(issued.token, { secret })).toBeNull();
  });

  it("rejects a token whose payload is not an access claim", async () => {
    expect(await verifyAccessToken("not-a-jwt", { secret })).toBeNull();
  });
});

describe("refresh tokens", () => {
  it("generates a unique url-safe value", () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateRefreshToken()));

    expect(tokens.size).toBe(50);
    for (const token of tokens) {
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    }
  });

  it("hashes deterministically and never returns the raw token", () => {
    const token = generateRefreshToken();
    const hash = hashRefreshToken(token);

    expect(hash).toBe(hashRefreshToken(token));
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain(token);
    expect(hash).not.toBe(hashRefreshToken(generateRefreshToken()));
  });
});
