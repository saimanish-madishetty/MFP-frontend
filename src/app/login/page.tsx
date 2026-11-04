"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { api } from "@/lib/api";
import { setToken, type User } from "@/lib/auth";
import { LOGGED_IN_EVENT } from "@/components/AuthGate";
import { Button, Card, ErrorBox, Field, Input } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ token: string; user: User }>("/auth/login", "POST", { phone, pin });
      setToken(res.token);
      await mutate("/auth/me", res.user, { revalidate: false });
      window.dispatchEvent(new Event(LOGGED_IN_EVENT));
      router.replace("/");
    } catch (err) {
      setError(err);
      setPin("");
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface-2 p-4 pt-safe-top pb-safe-bottom">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Image src="/mahadeva_icon.jpeg" alt="" width={64} height={64} className="h-16 w-16 rounded-2xl shadow" />
          <div>
            <h1 className="text-xl font-semibold">Mahadeva Foods</h1>
            <p className="text-sm text-muted">Stock &amp; Sales</p>
          </div>
        </div>
        <Card className="p-5">
          <form onSubmit={submit} className="space-y-4">
            <Field label="Mobile number">
              <Input
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                required
                autoFocus
                maxLength={16}
                placeholder="98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </Field>
            <Field label="PIN">
              <Input
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                required
                pattern="\d{4,6}"
                minLength={4}
                maxLength={6}
                placeholder="4 to 6 digits"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                className="tracking-[0.4em]"
              />
            </Field>
            <ErrorBox error={error} />
            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy ? "Logging in…" : "Log in"}
            </Button>
          </form>
        </Card>
        <p className="text-center text-xs text-muted">Forgot your PIN or need access? Ask an admin.</p>
      </div>
    </div>
  );
}
