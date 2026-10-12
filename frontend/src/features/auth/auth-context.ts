import { createContext, useContext } from "react";

import type { AuthUser, LoginRequest, RegisterRequest } from "@mach/contracts";

import type { ApiClient } from "./api-client";

export type AuthStatus = "loading" | "anonymous" | "authenticated" | "error";

export interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  sessionError: string;
  /** Shared client so every feature reuses one access token and one refresh. */
  client: ApiClient;
  login(input: LoginRequest): Promise<void>;
  register(input: RegisterRequest): Promise<void>;
  logout(): Promise<void>;
  retrySession(): Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("AuthProvider is required");
  return context;
}
