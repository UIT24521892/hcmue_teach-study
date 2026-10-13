import type { User } from "@prisma/client";

import type { AuthUser } from "@mach/contracts";

import { toContractRole } from "../../lib/roles.js";

/** Public projection of a `User` row. Excludes password and token material. */
export function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: toContractRole(user.role),
    timezone: user.timezone,
    createdAt: user.createdAt.toISOString(),
  };
}
