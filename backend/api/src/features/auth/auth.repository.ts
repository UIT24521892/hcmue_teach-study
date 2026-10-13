import type { Prisma, RefreshToken, User } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";

export interface RotateRefreshTokenInput {
  currentTokenId: string;
  userId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
  userAgent: string | null;
  rotatedAt: Date;
}

export const authRepository = {
  findActiveUserByEmail(email: string): Promise<User | null> {
    return prisma.user.findFirst({ where: { email, deletedAt: null } });
  },

  findActiveUserById(id: string): Promise<User | null> {
    return prisma.user.findFirst({ where: { id, deletedAt: null } });
  },

  createUser(data: Prisma.UserCreateInput): Promise<User> {
    return prisma.user.create({ data });
  },

  createRefreshToken(data: Prisma.RefreshTokenUncheckedCreateInput): Promise<RefreshToken> {
    return prisma.refreshToken.create({ data });
  },

  findRefreshTokenByHash(tokenHash: string): Promise<RefreshToken | null> {
    return prisma.refreshToken.findUnique({ where: { tokenHash } });
  },

  /** Used when a token is replayed or a session is explicitly ended. */
  async revokeFamily(familyId: string, revokedAt = new Date()): Promise<number> {
    const result = await prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt },
    });

    return result.count;
  },

  /**
   * Revokes the presented token and issues its successor in one transaction, so
   * a crash can never leave two live tokens inside the same family.
   */
  rotateRefreshToken(input: RotateRefreshTokenInput): Promise<RefreshToken | null> {
    return prisma.$transaction(async (transaction) => {
      const claimed = await transaction.refreshToken.updateMany({
        where: {
          id: input.currentTokenId,
          userId: input.userId,
          familyId: input.familyId,
          revokedAt: null,
        },
        data: { revokedAt: input.rotatedAt },
      });

      if (claimed.count !== 1) {
        return null;
      }

      const next = await transaction.refreshToken.create({
        data: {
          userId: input.userId,
          familyId: input.familyId,
          tokenHash: input.tokenHash,
          expiresAt: input.expiresAt,
          userAgent: input.userAgent,
        },
      });

      await transaction.refreshToken.update({
        where: { id: input.currentTokenId },
        data: { replacedById: next.id },
      });

      return next;
    });
  },
};

export type AuthRepository = typeof authRepository;
