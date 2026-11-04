"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import useSWR, { useSWRConfig } from "swr";
import { ApiError } from "@/lib/api";
import { LOGGED_OUT_EVENT, clearToken, getToken, type User } from "@/lib/auth";
import { AuthContext, type AuthState } from "@/lib/use-auth";
import AppShell from "@/components/AppShell";
import { Button, ErrorBox, Loading } from "@/components/ui";

/** Fired after logging in, so the gate picks up the new token. */
export const LOGGED_IN_EVENT = "mfp:logged-in";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(LOGGED_OUT_EVENT, onChange);
  window.addEventListener(LOGGED_IN_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(LOGGED_OUT_EVENT, onChange);
    window.removeEventListener(LOGGED_IN_EVENT, onChange);
  };
}

/** Pages that change data; view-only users get a message instead. */
const EDIT_PAGE = /\/(new|edit)\/?$/;

/**
 * Shows the login page until someone is logged in, then the app with their user in context.
 * The token is checked with the server on start (/auth/me); a 401 anywhere logs out.
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const token = useSyncExternalStore(subscribe, getToken, () => null);
  const onLogin = pathname.startsWith("/login");
  const { data: user, error, mutate: recheck } = useSWR<User>(token ? "/auth/me" : null, {
    revalidateOnFocus: false,
  });

  useEffect(() => {
    if (!token && !onLogin) router.replace("/login/");
    else if (token && user && onLogin) router.replace("/");
  }, [token, user, onLogin, router]);

  const logout = useCallback(() => {
    clearToken();
    // Drop everything cached for this user.
    mutate(() => true, undefined, { revalidate: false });
    window.dispatchEvent(new Event(LOGGED_OUT_EVENT));
  }, [mutate]);

  const auth = useMemo<AuthState | null>(
    () =>
      user
        ? { user, isAdmin: user.role === "ADMIN", canEdit: user.role === "ADMIN", logout }
        : null,
    [user, logout],
  );

  if (onLogin) return <>{children}</>;
  if (!token) return null;
  // Checking the login with the server (shown briefly on start).
  if (!auth) {
    // Server unreachable (e.g. waking up): offer a retry instead of logging out.
    if (error && !(error instanceof ApiError && error.status === 401))
      return (
        <div className="mx-auto mt-16 max-w-sm space-y-3 p-4">
          <ErrorBox error={error} />
          <Button onClick={() => recheck()}>Try again</Button>
        </div>
      );
    return <Loading />;
  }
  return (
    <AuthContext.Provider value={auth}>
      <AppShell>
        {!auth.canEdit && EDIT_PAGE.test(pathname) ? (
          <p className="mx-auto mt-16 max-w-sm rounded-lg border border-border bg-surface p-4 text-center text-sm">
            You have view-only access. Ask an admin to make changes.
          </p>
        ) : (
          children
        )}
      </AppShell>
    </AuthContext.Provider>
  );
}
