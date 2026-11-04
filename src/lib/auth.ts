export type Role = "ADMIN" | "VIEWER";

export type User = { id: number; name: string; phone: string; role: Role };

export type UserRow = User & { active: boolean; lastLoginAt: string | null; lockedUntil: string | null };

export const ROLE_LABEL: Record<Role, string> = { ADMIN: "Admin", VIEWER: "View only" };

export const ROLE_HINT: Record<Role, string> = {
  ADMIN: "Can see and change everything, and add users",
  VIEWER: "Can see everything, can't change anything",
};

const KEY = "mfp.token";

// The login token lives in localStorage (kept by the Android app across restarts).
export function getToken(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string) {
  try {
    localStorage.setItem(KEY, token);
  } catch {
    /* private mode: login lasts for this page only */
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Fired when the server says the login is no longer valid (expired, PIN reset, disabled). */
export const LOGGED_OUT_EVENT = "mfp:logged-out";

/** "98765 43210" */
export const formatPhone = (p: string) => (p.length === 10 ? `${p.slice(0, 5)} ${p.slice(5)}` : p);
