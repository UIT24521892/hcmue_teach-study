import {
  authMeResponseSchema,
  authSessionSchema,
  logoutResponseSchema,
  type AuthMeResponse,
  type AuthSession,
  type LoginRequest,
  type LogoutResponse,
  type RegisterRequest,
} from "@mach/contracts";

import type { ApiClient } from "./api-client";

/** Thin, typed wrapper over the `/auth` endpoints. No business rules here. */
export function createAuthApi(client: ApiClient) {
  return {
    login(input: LoginRequest): Promise<AuthSession> {
      return client.request("/auth/login", {
        method: "POST",
        body: input,
        schema: authSessionSchema,
        skipRefresh: true,
      });
    },

    register(input: RegisterRequest): Promise<AuthSession> {
      return client.request("/auth/register", {
        method: "POST",
        body: input,
        schema: authSessionSchema,
        skipRefresh: true,
      });
    },

    me(): Promise<AuthMeResponse> {
      return client.request("/auth/me", { schema: authMeResponseSchema });
    },

    logout(): Promise<LogoutResponse> {
      return client.request("/auth/logout", {
        method: "POST",
        schema: logoutResponseSchema,
        skipRefresh: true,
      });
    },
  };
}

export type AuthApi = ReturnType<typeof createAuthApi>;
