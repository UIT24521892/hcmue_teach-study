import type { CookieOptions, Request, Response } from "express";

/** The refresh cookie is only ever sent to the auth endpoints. */
export const REFRESH_COOKIE_PATH = "/api/v1/auth";

export interface RefreshCookieConfig {
  cookieName: string;
  cookieSecure: boolean;
}

function baseOptions(config: RefreshCookieConfig): CookieOptions {
  return {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: "lax",
    path: REFRESH_COOKIE_PATH,
  };
}

export function setRefreshCookie(
  response: Response,
  token: string,
  expiresAt: Date,
  config: RefreshCookieConfig,
): void {
  response.cookie(config.cookieName, token, { ...baseOptions(config), expires: expiresAt });
}

export function clearRefreshCookie(response: Response, config: RefreshCookieConfig): void {
  response.clearCookie(config.cookieName, baseOptions(config));
}

export function readRefreshCookie(request: Request, cookieName: string): string | undefined {
  const cookies = request.cookies as Record<string, unknown> | undefined;
  const value = cookies?.[cookieName];

  return typeof value === "string" && value.length > 0 ? value : undefined;
}
