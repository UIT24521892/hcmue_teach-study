import type { Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HttpError } from "../lib/http-error.js";
import { createRateLimiter } from "./rate-limit.js";

function createContext(ip = "203.0.113.7") {
  const headers: Record<string, string> = {};
  const request = { ip } as Request;
  const response = {
    setHeader(name: string, value: string) {
      headers[name] = value;
    },
  } as unknown as Response;

  return { request, response, headers, next: vi.fn() };
}

function lastError(next: ReturnType<typeof vi.fn>): unknown {
  return next.mock.calls.at(-1)?.[0];
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-18T00:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createRateLimiter", () => {
  it("allows requests up to the limit", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 3 });
    const { request, response, next } = createContext();

    for (let attempt = 0; attempt < 3; attempt += 1) {
      limiter(request, response, next);
    }

    expect(next).toHaveBeenCalledTimes(3);
    expect(next).toHaveBeenCalledWith();
  });

  it("blocks the request that exceeds the limit and advertises retry-after", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 2 });
    const { request, response, headers, next } = createContext();

    limiter(request, response, next);
    limiter(request, response, next);
    limiter(request, response, next);

    const error = lastError(next);
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(429);
    expect((error as HttpError).code).toBe("RATE_LIMITED");
    expect(headers["retry-after"]).toBe("60");
  });

  it("starts a fresh window once the previous one elapses", () => {
    const limiter = createRateLimiter({ windowMs: 1_000, max: 1 });
    const { request, response, next } = createContext();

    limiter(request, response, next);
    limiter(request, response, next);
    expect(lastError(next)).toBeInstanceOf(HttpError);

    vi.setSystemTime(new Date("2026-09-18T00:00:02.000Z"));
    const second = createContext();
    limiter(second.request, second.response, second.next);

    expect(second.next).toHaveBeenCalledWith();
  });

  it("counts each client address separately", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
    const first = createContext("203.0.113.7");
    const second = createContext("198.51.100.4");

    limiter(first.request, first.response, first.next);
    limiter(first.request, first.response, first.next);
    limiter(second.request, second.response, second.next);

    expect(lastError(first.next)).toBeInstanceOf(HttpError);
    expect(second.next).toHaveBeenCalledWith();
  });
});
