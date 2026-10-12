import { randomUUID } from "node:crypto";

import { compare, hash } from "bcryptjs";

import type { AuthSession, LoginRequest, RegisterRequest } from "@mach/contracts";

import { HttpError } from "../../lib/http-error.js";
import { toPrismaRole } from "../../lib/roles.js";
import { toAuthUser } from "./auth.mapper.js";
import { authRepository, type AuthRepository } from "./auth.repository.js";
import { createAccessToken, generateRefreshToken, hashRefreshToken } from "./auth.tokens.js";

const DEFAULT_PASSWORD_HASH_ROUNDS = 12;
export const REFRESH_CONCURRENCY_GRACE_MS = 5_000;
export const REFRESH_RETRY_AFTER_MS = 100;

export interface AuthServiceDependencies {
  accessTokenSecret: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlDays: number;
  /** Lowered in tests so suites stay fast; never lowered in production. */
  passwordHashRounds?: number;
  repository?: AuthRepository;
}

export interface IssuedSession {
  session: AuthSession;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

export interface AuthService {
  register(input: RegisterRequest, context: SessionContext): Promise<IssuedSession>;
  login(input: LoginRequest, context: SessionContext): Promise<IssuedSession>;
  refresh(rawRefreshToken: string | undefined, context: SessionContext): Promise<IssuedSession>;
  logout(rawRefreshToken: string | undefined): Promise<void>;
  getProfile(userId: string): Promise<AuthSession["user"]>;
}

export interface SessionContext {
  userAgent: string | null;
}

function isRecentRotation(revokedAt: Date, replacedById: string | null, now: Date): boolean {
  const age = now.getTime() - revokedAt.getTime();
  return replacedById !== null && age >= 0 && age <= REFRESH_CONCURRENCY_GRACE_MS;
}

/**
 * A throwaway digest compared against when the email is unknown, so a failed
 * login costs roughly the same time whether or not the account exists.
 */
let dummyPasswordHash: Promise<string> | null = null;

function loadDummyPasswordHash(rounds: number): Promise<string> {
  dummyPasswordHash ??= hash("mach-dummy-password", rounds);
  return dummyPasswordHash;
}

export function createAuthService(dependencies: AuthServiceDependencies): AuthService {
  const repository = dependencies.repository ?? authRepository;
  const passwordHashRounds = dependencies.passwordHashRounds ?? DEFAULT_PASSWORD_HASH_ROUNDS;

  function refreshExpiry(now: Date): Date {
    return new Date(now.getTime() + dependencies.refreshTokenTtlDays * 24 * 60 * 60 * 1000);
  }

  async function issueSession(
    user: Parameters<typeof toAuthUser>[0],
    context: SessionContext,
    familyId = randomUUID(),
  ): Promise<IssuedSession> {
    const now = new Date();
    const refreshToken = generateRefreshToken();
    const refreshTokenExpiresAt = refreshExpiry(now);

    await repository.createRefreshToken({
      userId: user.id,
      familyId,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: refreshTokenExpiresAt,
      userAgent: context.userAgent,
    });

    const accessToken = await createAccessToken(
      { userId: user.id, role: toAuthUser(user).role },
      {
        secret: dependencies.accessTokenSecret,
        ttlSeconds: dependencies.accessTokenTtlSeconds,
      },
    );

    return {
      session: {
        user: toAuthUser(user),
        accessToken: accessToken.token,
        accessTokenExpiresAt: accessToken.expiresAt.toISOString(),
      },
      refreshToken,
      refreshTokenExpiresAt,
    };
  }

  return {
    async register(input, context) {
      const existing = await repository.findActiveUserByEmail(input.email);
      if (existing) {
        throw HttpError.conflict("Email này đã được sử dụng.");
      }

      const created = await repository.createUser({
        name: input.name,
        email: input.email,
        // `input.role` is a `SelfRegisterableRole`, so `admin` cannot be
        // self-assigned even if a caller bypasses the HTTP schema.
        role: toPrismaRole(input.role),
        passwordHash: await hash(input.password, passwordHashRounds),
        ...(input.timezone ? { timezone: input.timezone } : {}),
      });

      return issueSession(created, context);
    },

    async login(input, context) {
      const user = await repository.findActiveUserByEmail(input.email);
      const passwordMatches = await compare(
        input.password,
        user?.passwordHash ?? (await loadDummyPasswordHash(passwordHashRounds)),
      );

      if (!user || !passwordMatches) {
        throw HttpError.unauthenticated("Email hoặc mật khẩu không đúng.");
      }

      return issueSession(user, context);
    },

    async refresh(rawRefreshToken, context) {
      if (!rawRefreshToken) {
        throw HttpError.unauthenticated("Phiên đăng nhập không hợp lệ.");
      }

      const stored = await repository.findRefreshTokenByHash(hashRefreshToken(rawRefreshToken));
      if (!stored) {
        throw HttpError.unauthenticated("Phiên đăng nhập không hợp lệ.");
      }

      const now = new Date();

      // A just-rotated token is commonly presented by a second tab before the
      // browser has applied the winner's Set-Cookie header. Ask that caller to
      // retry without revoking the family or clearing the shared cookie.
      if (stored.revokedAt) {
        if (isRecentRotation(stored.revokedAt, stored.replacedById, now)) {
          throw HttpError.sessionRefreshConflict(REFRESH_RETRY_AFTER_MS);
        }

        // Outside the narrow concurrency window, reuse is treated as replay.
        await repository.revokeFamily(stored.familyId);
        throw HttpError.unauthenticated("Phiên đăng nhập đã hết hiệu lực. Vui lòng đăng nhập lại.");
      }

      if (stored.expiresAt.getTime() <= now.getTime()) {
        await repository.revokeFamily(stored.familyId);
        throw HttpError.unauthenticated("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      }

      const user = await repository.findActiveUserById(stored.userId);
      if (!user) {
        await repository.revokeFamily(stored.familyId);
        throw HttpError.unauthenticated("Tài khoản không còn khả dụng.");
      }

      const nextRefreshToken = generateRefreshToken();
      const refreshTokenExpiresAt = refreshExpiry(now);

      const rotated = await repository.rotateRefreshToken({
        currentTokenId: stored.id,
        userId: user.id,
        familyId: stored.familyId,
        tokenHash: hashRefreshToken(nextRefreshToken),
        expiresAt: refreshTokenExpiresAt,
        userAgent: context.userAgent,
        rotatedAt: now,
      });

      if (!rotated) {
        throw HttpError.sessionRefreshConflict(REFRESH_RETRY_AFTER_MS);
      }

      const accessToken = await createAccessToken(
        { userId: user.id, role: toAuthUser(user).role },
        {
          secret: dependencies.accessTokenSecret,
          ttlSeconds: dependencies.accessTokenTtlSeconds,
        },
      );

      return {
        session: {
          user: toAuthUser(user),
          accessToken: accessToken.token,
          accessTokenExpiresAt: accessToken.expiresAt.toISOString(),
        },
        refreshToken: nextRefreshToken,
        refreshTokenExpiresAt,
      };
    },

    async logout(rawRefreshToken) {
      if (!rawRefreshToken) {
        return;
      }

      const stored = await repository.findRefreshTokenByHash(hashRefreshToken(rawRefreshToken));
      if (stored) {
        await repository.revokeFamily(stored.familyId);
      }
    },

    async getProfile(userId) {
      const user = await repository.findActiveUserById(userId);
      if (!user) {
        throw HttpError.unauthenticated("Tài khoản không còn khả dụng.");
      }

      return toAuthUser(user);
    },
  };
}
