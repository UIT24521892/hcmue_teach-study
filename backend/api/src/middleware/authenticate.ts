import type { NextFunction, Request, Response } from "express";

import type { UserRole } from "@mach/contracts";

import { authRepository, type AuthRepository } from "../features/auth/auth.repository.js";
import { verifyAccessToken } from "../features/auth/auth.tokens.js";
import { HttpError } from "../lib/http-error.js";
import { toContractRole } from "../lib/roles.js";

export interface AuthContext {
  userId: string;
  role: UserRole;
}

export interface AuthenticateOptions {
  accessTokenSecret: string;
  repository?: AuthRepository;
}

function bearerToken(request: Request): string | null {
  const header = request.header("authorization");
  if (!header) {
    return null;
  }

  const [scheme, value] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !value) {
    return null;
  }

  return value;
}

/**
 * Verifies the access token and then re-reads the user, so a soft delete or a
 * role change applies to the very next request instead of waiting for the
 * token to expire. The database role — not the token claim — is authoritative.
 */
export function createAuthenticateMiddleware(options: AuthenticateOptions) {
  const repository = options.repository ?? authRepository;

  return async function authenticate(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    const token = bearerToken(request);
    if (!token) {
      next(HttpError.unauthenticated());
      return;
    }

    const subject = await verifyAccessToken(token, { secret: options.accessTokenSecret });
    if (!subject) {
      next(HttpError.unauthenticated("Phiên đăng nhập đã hết hạn."));
      return;
    }

    const user = await repository.findActiveUserById(subject.userId);
    if (!user) {
      next(HttpError.unauthenticated("Tài khoản không còn khả dụng."));
      return;
    }

    const auth: AuthContext = { userId: user.id, role: toContractRole(user.role) };
    response.locals.auth = auth;
    next();
  };
}

export function getAuthContext(response: Response): AuthContext {
  const auth = (response.locals as { auth?: AuthContext }).auth;
  if (!auth) {
    throw HttpError.unauthenticated();
  }

  return auth;
}
