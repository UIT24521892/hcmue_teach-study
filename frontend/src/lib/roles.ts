import type { UserRole } from "@mach/contracts";

/**
 * Single source of truth for role labels. The demo experience and the real
 * session both read from here so the two can never drift apart.
 */
export const roleLabels: Record<UserRole, string> = {
  teacher: "Giáo viên",
  student: "Học sinh",
  self_learner: "Người tự học",
  admin: "Quản trị",
};

/** Roles a person can pick for themselves. `admin` is never self-assignable. */
export const selfRegisterableRoles = ["teacher", "student", "self_learner"] as const;

export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((word) => word[0] ?? "")
    .slice(-2)
    .join("")
    .toUpperCase();
}
