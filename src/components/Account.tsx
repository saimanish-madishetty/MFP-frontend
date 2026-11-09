"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { ROLE_LABEL, formatPhone, setToken } from "@/lib/auth";
import { useAuth } from "@/lib/use-auth";
import { LOGGED_IN_EVENT } from "@/components/AuthGate";
import { AppVersion } from "@/components/AppVersion";
import { Badge, Button, ErrorBox, Field, Input, Sheet } from "@/components/ui";

const pinInput = (value: string, set: (v: string) => void, autoFocus = false) => (
  <Input
    type="password"
    inputMode="numeric"
    required
    pattern="\d{4,6}"
    minLength={4}
    maxLength={6}
    autoFocus={autoFocus}
    value={value}
    onChange={(e) => set(e.target.value.replace(/\D/g, ""))}
    className="tracking-[0.4em]"
  />
);

function ChangePinSheet({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next !== again) return setError(new Error("The new PINs don't match"));
    setBusy(true);
    setError(null);
    try {
      // Other devices are logged out; this one gets a fresh token.
      const res = await api<{ token: string }>("/auth/pin", "POST", { currentPin: current, newPin: next });
      setToken(res.token);
      window.dispatchEvent(new Event(LOGGED_IN_EVENT));
      setDone(true);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open title="Change PIN" onClose={onClose}>
      {done ? (
        <div className="space-y-4 text-sm">
          <p>PIN changed. You&apos;re logged out on any other phone or computer.</p>
          <Button className="w-full" onClick={onClose}>
            Done
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Current PIN">{pinInput(current, setCurrent, true)}</Field>
          <Field label="New PIN" hint="4 to 6 digits">
            {pinInput(next, setNext)}
          </Field>
          <Field label="New PIN again">{pinInput(again, setAgain)}</Field>
          <ErrorBox error={error} />
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Saving…" : "Change PIN"}
          </Button>
        </form>
      )}
    </Sheet>
  );
}

/** Bottom of the menu: who is logged in, Change PIN, Log out. */
export function AccountPanel() {
  const { user, logout } = useAuth();
  const [sheet, setSheet] = useState(false);
  return (
    <div className="mt-auto">
      <AppVersion />
      <div className="border-t border-border p-3 pb-safe-bottom">
        <div className="px-3 py-2">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="flex items-center gap-2 text-xs text-muted">
            {formatPhone(user.phone)}
            <Badge tone={user.role === "ADMIN" ? "brand" : "neutral"}>{ROLE_LABEL[user.role]}</Badge>
          </p>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" className="flex-1" onClick={() => setSheet(true)}>
            Change PIN
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1"
            onClick={() => confirm("Log out of the app on this device?") && logout()}
          >
            Log out
          </Button>
        </div>
        {sheet && <ChangePinSheet onClose={() => setSheet(false)} />}
      </div>
    </div>
  );
}
