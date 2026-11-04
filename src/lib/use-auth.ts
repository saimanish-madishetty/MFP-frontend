"use client";

import { createContext, useContext } from "react";
import type { User } from "./auth";

export type AuthState = {
  user: User;
  isAdmin: boolean;
  /** False for view-only users: hide add / edit / delete controls. */
  canEdit: boolean;
  logout: () => void;
};

export const AuthContext = createContext<AuthState | null>(null);

/** The logged-in user. Only used inside the app (AuthGate renders nothing until logged in). */
export function useAuth(): AuthState {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("useAuth outside AuthGate");
  return auth;
}

/** Like useAuth().canEdit, but safe outside the gate (e.g. the login page): false there. */
export function useCanEdit(): boolean {
  return useContext(AuthContext)?.canEdit ?? false;
}
