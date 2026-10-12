import type { z } from "zod";

import { authSessionSchema, errorResponseSchema, type AuthSession } from "@mach/contracts";

import { webEnv } from "../../config/env";

/**
 * Error carrying the API error envelope (`code`, `message`, `requestId`), so
 * screens can branch on `code` instead of matching on message text.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId: string;
  readonly details: unknown;

  constructor(input: {
    status: number;
    code: string;
    message: string;
    requestId: string;
    details: unknown;
  }) {
    super(input.message);
    this.name = "ApiError";
    this.status = input.status;
    this.code = input.code;
    this.requestId = input.requestId;
    this.details = input.details;
  }
}

export interface RequestOptions<T> {
  schema: z.ZodType<T>;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /**
   * Credential endpoints return 401 for bad input, not for an expired session,
   * so they must never trigger the refresh-and-retry path.
   */
  skipRefresh?: boolean;
}

export interface ApiClient {
  setAccessToken(token: string | null): void;
  request<T>(path: string, options: RequestOptions<T>): Promise<T>;
  /** Exchanges the httpOnly refresh cookie for a new session, or returns null. */
  refreshSession(): Promise<AuthSession | null>;
}

export interface ApiClientConfig {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  onSessionRefreshed?: (session: AuthSession) => void;
  onSessionLost?: () => void;
}

interface SendOptions {
  method?: string;
  body?: unknown;
}

function invalidResponse(status: number, details: unknown): ApiError {
  return new ApiError({
    status,
    code: "INVALID_RESPONSE",
    message: "Máy chủ trả về dữ liệu không đúng định dạng.",
    requestId: "",
    details,
  });
}

function retryDelayOf(error: ApiError): number {
  if (
    typeof error.details === "object" &&
    error.details !== null &&
    "retryAfterMs" in error.details &&
    typeof error.details.retryAfterMs === "number"
  ) {
    return Math.min(Math.max(error.details.retryAfterMs, 0), 1_000);
  }

  return 100;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export function createApiClient(config: ApiClientConfig = {}): ApiClient {
  const baseUrl = (config.baseUrl ?? webEnv.VITE_API_URL).replace(/\/+$/, "");
  // The access token lives in memory only: never localStorage, so an XSS bug
  // cannot read a long-lived credential out of storage.
  let accessToken: string | null = null;
  let refreshInFlight: Promise<AuthSession | null> | null = null;

  function currentFetch(): typeof fetch {
    // Resolved per call so tests can stub `globalThis.fetch` after import.
    return config.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  async function toApiError(response: Response): Promise<ApiError> {
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      payload = undefined;
    }

    const parsed = errorResponseSchema.safeParse(payload);
    if (parsed.success) {
      return new ApiError({
        status: response.status,
        code: parsed.data.code,
        message: parsed.data.message,
        requestId: parsed.data.requestId,
        details: parsed.data.details,
      });
    }

    return new ApiError({
      status: response.status,
      code: "UNKNOWN",
      message: `Yêu cầu thất bại (HTTP ${response.status}).`,
      requestId: "",
      details: undefined,
    });
  }

  async function send(path: string, options: SendOptions): Promise<Response> {
    const headers: Record<string, string> = { accept: "application/json" };
    const isMultipart = typeof FormData !== "undefined" && options.body instanceof FormData;
    if (options.body !== undefined && !isMultipart) {
      headers["content-type"] = "application/json";
    }
    if (accessToken) {
      headers.authorization = `Bearer ${accessToken}`;
    }

    const body: BodyInit | undefined =
      options.body === undefined
        ? undefined
        : isMultipart
          ? (options.body as FormData)
          : JSON.stringify(options.body);

    return currentFetch()(`${baseUrl}${path}`, {
      method: options.method ?? "GET",
      headers,
      // Required for the httpOnly refresh cookie to travel to the API.
      credentials: "include",
      ...(body === undefined ? {} : { body }),
    });
  }

  async function performRefresh(canRetryConflict = true): Promise<AuthSession | null> {
    const response = await send("/auth/refresh", { method: "POST" });
    if (response.status === 401) {
      accessToken = null;
      config.onSessionLost?.();
      return null;
    }

    if (!response.ok) {
      const error = await toApiError(response);
      if (error.code === "SESSION_REFRESH_CONFLICT" && canRetryConflict) {
        await wait(retryDelayOf(error));
        return performRefresh(false);
      }

      throw error;
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw invalidResponse(response.status, undefined);
    }

    const parsed = authSessionSchema.safeParse(payload);
    if (!parsed.success) {
      throw invalidResponse(response.status, parsed.error.flatten().fieldErrors);
    }

    const session = parsed.data;
    accessToken = session.accessToken;
    config.onSessionRefreshed?.(session);
    return session;
  }

  function refreshSession(): Promise<AuthSession | null> {
    // Single flight: several requests hitting 401 at once must produce exactly
    // one rotation, otherwise the extra rotations would revoke each other.
    if (!refreshInFlight) {
      refreshInFlight = performRefresh().finally(() => {
        refreshInFlight = null;
      });
    }

    return refreshInFlight;
  }

  async function request<T>(path: string, options: RequestOptions<T>): Promise<T> {
    const sendOptions: SendOptions = {
      ...(options.method === undefined ? {} : { method: options.method }),
      ...(options.body === undefined ? {} : { body: options.body }),
    };

    let response = await send(path, sendOptions);

    if (response.status === 401 && options.skipRefresh !== true) {
      const session = await refreshSession();
      if (session) {
        response = await send(path, sendOptions);
      }
    }

    if (!response.ok) {
      throw await toApiError(response);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw invalidResponse(response.status, undefined);
    }

    const parsed = options.schema.safeParse(payload);
    if (!parsed.success) {
      throw invalidResponse(response.status, parsed.error.flatten().fieldErrors);
    }

    return parsed.data;
  }

  return {
    setAccessToken(token) {
      accessToken = token;
    },
    request,
    refreshSession,
  };
}
