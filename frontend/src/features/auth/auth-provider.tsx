import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import type { LoginRequest, RegisterRequest } from "@mach/contracts";

import { createApiClient } from "./api-client";
import { createAuthApi } from "./auth-api";
import { AuthContext, type AuthContextValue, type AuthStatus } from "./auth-context";

/**
 * Owns the browser session. The access token never leaves memory, so a page
 * reload re-establishes the session by exchanging the httpOnly refresh cookie
 * instead of reading a token out of storage.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthContextValue["user"]>(null);
  const [sessionError, setSessionError] = useState("");

  const [client] = useState(() =>
    createApiClient({
      onSessionRefreshed: (session) => {
        setUser(session.user);
        setStatus("authenticated");
        setSessionError("");
      },
      onSessionLost: () => {
        setUser(null);
        setStatus("anonymous");
        setSessionError("");
      },
    }),
  );
  const api = useMemo(() => createAuthApi(client), [client]);

  const retrySession = useCallback(async () => {
    setStatus("loading");
    setSessionError("");
    try {
      const session = await client.refreshSession();
      if (session) {
        setUser(session.user);
        setStatus("authenticated");
        return;
      }

      setUser(null);
      setStatus("anonymous");
    } catch {
      setUser(null);
      setStatus("error");
      setSessionError("Không thể kiểm tra phiên đăng nhập. Kiểm tra kết nối rồi thử lại.");
    }
  }, [client]);

  useEffect(() => {
    void retrySession();
  }, [retrySession]);

  const login = useCallback(
    async (input: LoginRequest) => {
      const session = await api.login(input);
      client.setAccessToken(session.accessToken);
      setUser(session.user);
      setStatus("authenticated");
      setSessionError("");
    },
    [api, client],
  );

  const register = useCallback(
    async (input: RegisterRequest) => {
      const session = await api.register(input);
      client.setAccessToken(session.accessToken);
      setUser(session.user);
      setStatus("authenticated");
      setSessionError("");
    },
    [api, client],
  );

  const logout = useCallback(async () => {
    await api.logout();
    client.setAccessToken(null);
    setUser(null);
    setStatus("anonymous");
    setSessionError("");
  }, [api, client]);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, sessionError, client, login, register, logout, retrySession }),
    [status, user, sessionError, client, login, register, logout, retrySession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
