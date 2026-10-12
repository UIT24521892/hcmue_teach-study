import { UserRole as PrismaUserRole } from "@prisma/client";

import type { UserRole } from "@mach/contracts";

/**
 * The database stores roles as SCREAMING_CASE enum values while the public API
 * contract uses lower case. Both directions live here so a role can never be
 * translated inconsistently between features.
 */
const prismaToContract: Record<PrismaUserRole, UserRole> = {
  TEACHER: "teacher",
  STUDENT: "student",
  SELF_LEARNER: "self_learner",
  ADMIN: "admin",
};

const contractToPrisma: Record<UserRole, PrismaUserRole> = {
  teacher: PrismaUserRole.TEACHER,
  student: PrismaUserRole.STUDENT,
  self_learner: PrismaUserRole.SELF_LEARNER,
  admin: PrismaUserRole.ADMIN,
};

export function toContractRole(role: PrismaUserRole): UserRole {
  return prismaToContract[role];
}

export function toPrismaRole(role: UserRole): PrismaUserRole {
  return contractToPrisma[role];
}
