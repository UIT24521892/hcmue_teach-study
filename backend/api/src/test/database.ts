import { prisma } from "../lib/prisma.js";

/**
 * Removes every row the auth tests can create. This is intentionally broad and
 * is safe only because test setup accepts the exact disposable `mach_test`
 * database. `refresh_tokens` is deleted first because it references `users`.
 */
export async function resetAuthTables(): Promise<void> {
  await prisma.dailyNote.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.quiz.deleteMany();
  await prisma.document.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
}

export async function countActiveRefreshTokens(userId: string): Promise<number> {
  return prisma.refreshToken.count({ where: { userId, revokedAt: null } });
}
