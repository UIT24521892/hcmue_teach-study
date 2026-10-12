import { createHash, randomBytes } from "node:crypto";

import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";

import type { UserRole } from "@mach/contracts";

const ISSUER = "mach-api";
const AUDIENCE = "mach-web";

const accessTokenClaimsSchema = z.object({
  sub: z.string().min(1),
  role: z.enum(["teacher", "student", "self_learner", "admin"]),
  typ: z.literal("access"),
});

export interface AccessTokenSubject {
  userId: string;
  role: UserRole;
}

export interface AccessTokenResult {
  token: string;
  expiresAt: Date;
}

function secretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

/**
 * Short-lived bearer token. It carries only the user id and role: everything
 * else is re-read from the database on each request so a role change or a soft
 * delete takes effect without waiting for the token to expire.
 */
export async function createAccessToken(
  subject: AccessTokenSubject,
  options: { secret: string; ttlSeconds: number },
): Promise<AccessTokenResult> {
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + options.ttlSeconds * 1000);

  const token = await new SignJWT({ role: subject.role, typ: "access" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(subject.userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(Math.floor(issuedAt.getTime() / 1000))
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secretKey(options.secret));

  return { token, expiresAt };
}

/** Returns `null` for any invalid, expired or tampered token. */
export async function verifyAccessToken(
  token: string,
  options: { secret: string },
): Promise<AccessTokenSubject | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(options.secret), {
      algorithms: ["HS256"],
      issuer: ISSUER,
      audience: AUDIENCE,
    });

    const claims = accessTokenClaimsSchema.safeParse(payload);
    if (!claims.success) {
      return null;
    }

    return { userId: claims.data.sub, role: claims.data.role };
  } catch {
    return null;
  }
}

/** 256 bits of entropy, URL-safe so it can live in a cookie unencoded. */
export function generateRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Refresh tokens are already high-entropy random values, so a fast digest is
 * the right primitive here: unlike a password there is nothing to brute force.
 * The raw token never touches the database.
 */
export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
