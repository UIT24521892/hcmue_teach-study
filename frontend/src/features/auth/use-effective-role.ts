import type { UserRole } from "@mach/contracts";

import { useDemo } from "../demo/context";
import { useAuth } from "./auth-context";

/**
 * Role used for presentation. A server-authenticated identity always wins over
 * the anonymous demo preview; backend policies remain the security boundary.
 */
export function useEffectiveRole(): UserRole {
  const { user } = useAuth();
  const { data } = useDemo();

  return user?.role ?? data.role;
}
