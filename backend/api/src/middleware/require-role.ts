import type { NextFunction, Request, Response } from "express";

import type { UserRole } from "@mach/contracts";

import { HttpError } from "../lib/http-error.js";
import { getAuthContext } from "./authenticate.js";

/**
 * Route-level role gate. Always used after `authenticate`, and always paired
 * with a scoped query in the service: hiding a button in the UI is not access
 * control.
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return function roleGate(_request: Request, response: Response, next: NextFunction): void {
    const auth = (response.locals as { auth?: { role: UserRole } }).auth;
    if (!auth) {
      next(HttpError.unauthenticated());
      return;
    }

    if (!allowedRoles.includes(auth.role)) {
      next(HttpError.forbidden());
      return;
    }

    next();
  };
}

/** Convenience wrapper for routes that only need a valid session. */
export function requireAuthenticated(response: Response): { userId: string; role: UserRole } {
  return getAuthContext(response);
}
