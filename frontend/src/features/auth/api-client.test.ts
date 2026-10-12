import { z } from "zod";
import { describe, expect, it, vi } from "vitest";

import type { AuthSession } from "@mach/contracts";

import { createApiClient } from "./api-client";
import type { ApiError } from "./api-client";

const session: AuthSession = {
  user: {
    id: "user_1",
    name: "Lê Chi",
    email: "chi@example.com",
    role: "teacher",
    timezone: "Asia/Ho_Chi_Minh",
    createdAt: "2026-09-18T00:00:00.000Z",
  },
  accessToken: "header.payload.signature",
  accessTokenExpiresAt: "2026-09-18T01:00:00.000Z",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("createApiClient", () => {
  it("shares one refresh across concurrent unauthorized requests", async () => {
    let refreshCalls = 0;
    let initialProtectedCalls = 0;
    let releaseInitialRequests: (() => void) | undefined;
    const initialRequestsReady = new Promise<void>((resolve) => {
      releaseInitialRequests = resolve;
    });

    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      const headers = init?.headers as Record<string, string> | undefined;

      if (url.endsWith("/protected") && !headers?.authorization) {
        initialProtectedCalls += 1;
        if (initialProtectedCalls === 2) releaseInitialRequests?.();
        await initialRequestsReady;
        return jsonResponse(
          { code: "UNAUTHENTICATED", message: "Hết hạn", requestId: "req_1" },
          401,
        );
      }

      if (url.endsWith("/auth/refresh")) {
        refreshCalls += 1;
        return jsonResponse(session);
      }

      expect(headers?.authorization).toBe(`Bearer ${session.accessToken}`);
      return jsonResponse({ ok: true });
    });
    const client = createApiClient({ baseUrl: "http://api.test", fetchImpl });
    const schema = z.object({ ok: z.literal(true) });

    const results = await Promise.all([
      client.request("/protected", { schema }),
      client.request("/protected", { schema }),
    ]);

    expect(results).toEqual([{ ok: true }, { ok: true }]);
    expect(refreshCalls).toBe(1);
  });

  it("retries one refresh conflict and then accepts the winning cookie", async () => {
    let refreshCalls = 0;
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      refreshCalls += 1;
      if (refreshCalls === 1) {
        return jsonResponse(
          {
            code: "SESSION_REFRESH_CONFLICT",
            message: "Thử lại",
            details: { retryAfterMs: 0 },
            requestId: "req_conflict",
          },
          409,
        );
      }

      return jsonResponse(session);
    });
    const refreshed = vi.fn();
    const client = createApiClient({
      baseUrl: "http://api.test",
      fetchImpl,
      onSessionRefreshed: refreshed,
    });

    await expect(client.refreshSession()).resolves.toEqual(session);
    expect(refreshCalls).toBe(2);
    expect(refreshed).toHaveBeenCalledWith(session);
  });

  it("treats 401 as session loss but keeps transient failures recoverable", async () => {
    const lost = vi.fn();
    const unauthorized = createApiClient({
      baseUrl: "http://api.test",
      fetchImpl: vi.fn<typeof fetch>(async () => jsonResponse({}, 401)),
      onSessionLost: lost,
    });

    await expect(unauthorized.refreshSession()).resolves.toBeNull();
    expect(lost).toHaveBeenCalledTimes(1);

    const offlineLost = vi.fn();
    const offline = createApiClient({
      baseUrl: "http://api.test",
      fetchImpl: vi.fn<typeof fetch>(async () => {
        throw new TypeError("offline");
      }),
      onSessionLost: offlineLost,
    });

    await expect(offline.refreshSession()).rejects.toThrow("offline");
    expect(offlineLost).not.toHaveBeenCalled();
  });

  it("rejects a malformed successful refresh response", async () => {
    const client = createApiClient({
      baseUrl: "http://api.test",
      fetchImpl: vi.fn<typeof fetch>(async () => jsonResponse({ user: null })),
    });

    await expect(client.refreshSession()).rejects.toMatchObject<Partial<ApiError>>({
      code: "INVALID_RESPONSE",
    });
  });

  it("sends FormData without overriding its multipart boundary", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (_input, init) => {
      const headers = init?.headers as Record<string, string>;
      expect(headers["content-type"]).toBeUndefined();
      expect(init?.body).toBeInstanceOf(FormData);
      return jsonResponse({ ok: true });
    });
    const client = createApiClient({ baseUrl: "http://api.test", fetchImpl });
    const form = new FormData();
    form.set("file", new File(["lesson"], "lesson.txt", { type: "text/plain" }));

    await expect(
      client.request("/documents", {
        method: "POST",
        body: form,
        schema: z.object({ ok: z.literal(true) }),
      }),
    ).resolves.toEqual({ ok: true });
  });
});
