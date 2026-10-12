import { Router, type Request } from "express";

import {
  loginRequestSchema,
  registerRequestSchema,
  type AuthMeResponse,
  type LogoutResponse,
} from "@mach/contracts";

import { parseInput } from "../../lib/validate.js";
import { HttpError } from "../../lib/http-error.js";
import { createAuthenticateMiddleware, getAuthContext } from "../../middleware/authenticate.js";
import { createRateLimiter, type RateLimitOptions } from "../../middleware/rate-limit.js";
import {
  clearRefreshCookie,
  readRefreshCookie,
  setRefreshCookie,
  type RefreshCookieConfig,
} from "./auth.cookies.js";
import { createAuthService, type AuthServiceDependencies } from "./auth.service.js";

export interface AuthRouterOptions extends AuthServiceDependencies, RefreshCookieConfig {
  credentialRateLimit?: RateLimitOptions;
  refreshRateLimit?: RateLimitOptions;
}

/** Credential endpoints are the cheapest to abuse, so they are the tightest. */
const DEFAULT_CREDENTIAL_RATE_LIMIT: RateLimitOptions = { windowMs: 15 * 60 * 1000, max: 10 };
const DEFAULT_REFRESH_RATE_LIMIT: RateLimitOptions = { windowMs: 15 * 60 * 1000, max: 60 };

function userAgentOf(request: Request): string | null {
  const value = request.header("user-agent");

  return value ? value.slice(0, 255) : null;
}

export function createAuthRouter(options: AuthRouterOptions) {
  const router = Router();
  const service = createAuthService(options);
  const authenticate = createAuthenticateMiddleware({
    accessTokenSecret: options.accessTokenSecret,
  });
  const credentialLimiter = createRateLimiter(
    options.credentialRateLimit ?? DEFAULT_CREDENTIAL_RATE_LIMIT,
  );
  const refreshLimiter = createRateLimiter(options.refreshRateLimit ?? DEFAULT_REFRESH_RATE_LIMIT);

  router.post("/register", credentialLimiter, async (request, response) => {
    const input = parseInput(registerRequestSchema, request.body);
    const issued = await service.register(input, { userAgent: userAgentOf(request) });

    setRefreshCookie(response, issued.refreshToken, issued.refreshTokenExpiresAt, options);
    response.status(201).json(issued.session);
  });

  router.post("/login", credentialLimiter, async (request, response) => {
    const input = parseInput(loginRequestSchema, request.body);
    const issued = await service.login(input, { userAgent: userAgentOf(request) });

    setRefreshCookie(response, issued.refreshToken, issued.refreshTokenExpiresAt, options);
    response.status(200).json(issued.session);
  });

  router.post("/refresh", refreshLimiter, async (request, response) => {
    try {
      const issued = await service.refresh(readRefreshCookie(request, options.cookieName), {
        userAgent: userAgentOf(request),
      });

      setRefreshCookie(response, issued.refreshToken, issued.refreshTokenExpiresAt, options);
      response.status(200).json(issued.session);
    } catch (error) {
      // Only definitive session loss clears the cookie. A concurrent refresh,
      // database outage or unexpected server error must preserve the browser's
      // last usable refresh credential so the user can retry safely.
      if (error instanceof HttpError && error.code === "UNAUTHENTICATED") {
        clearRefreshCookie(response, options);
      }
      throw error;
    }
  });

  router.post("/logout", async (request, response) => {
    await service.logout(readRefreshCookie(request, options.cookieName));
    clearRefreshCookie(response, options);
    response.status(200).json({ success: true } satisfies LogoutResponse);
  });

  router.get("/me", authenticate, async (_request, response) => {
    const auth = getAuthContext(response);
    const user = await service.getProfile(auth.userId);
    response.status(200).json({ user } satisfies AuthMeResponse);
  });

  return router;
}
