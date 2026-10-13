import type { NextFunction, Request, Response } from "express";

import { HttpError } from "../lib/http-error.js";

export interface RateLimitOptions {
  windowMs: number;
  max: number;
}

interface Hit {
  count: number;
  resetAt: number;
}

const MAX_TRACKED_CLIENTS = 10_000;

/**
 * Small per-instance fixed-window limiter used as a first line of defence.
 * Cost-bearing AI work also has a database-backed per-user quota, so scaling
 * the API horizontally cannot bypass the durable usage cap.
 */
export function createRateLimiter(options: RateLimitOptions) {
  const hits = new Map<string, Hit>();

  function prune(now: number): void {
    for (const [key, hit] of hits) {
      if (hit.resetAt <= now) {
        hits.delete(key);
      }
    }
  }

  return function rateLimit(request: Request, response: Response, next: NextFunction): void {
    const key = request.ip ?? "unknown";
    const now = Date.now();
    const current = hits.get(key);

    if (!current || current.resetAt <= now) {
      if (hits.size >= MAX_TRACKED_CLIENTS) {
        prune(now);
      }

      hits.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }

    current.count += 1;
    if (current.count > options.max) {
      response.setHeader("retry-after", String(Math.ceil((current.resetAt - now) / 1000)));
      next(new HttpError(429, "RATE_LIMITED", "Quá nhiều yêu cầu. Vui lòng thử lại sau ít phút."));
      return;
    }

    next();
  };
}
