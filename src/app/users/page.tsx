"use client";

import { useState } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import { ROLE_HINT, ROLE_LABEL, formatPhone, type Role, type UserRow } from "@/lib/auth";
import { formatDay } from "@/lib/format";
import { useAuth } from "@/lib/use-auth";
import { Badge, Button, Card, ErrorBox, Field, Input, Loading, PageHeader, Segmented, Sheet } from "@/components/ui";

const ROLES: { value: Role; label: string }[] = [
  { value: "VIEWER", label: ROLE_LABEL.VIEWER },
  { value: "ADMIN", label: ROLE_LABEL.ADMIN },
];

function UserSheet({ user, onClose, onSaved }: { user?: UserRow; onClose: () => void; onSaved: () => void }) {
  const { user: me } = useAuth();
  const isMe = user?.id === me.id;
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [role, setRole] = useState<Role>(user?.role ?? "VIEWER");
  const [active, setActive] = useState(user?.active ?? true);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onSaved();
      onClose();
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run(() =>
      user
        ? api(`/users/${user.id}`, "PATCH", { name, phone, role, active, ...(pin && { pin }) })
        : api("/users", "POST", { name, phone, role, pin }),
    );
  };

  const remove = () => {
    if (user && confirm(`Remove ${user.name}? They won't be able to log in.`))
      run(() => api(`/users/${user!.id}`, "DELETE"));
  };

  return (
    <Sheet open title={user ? `Edit ${user.name}` : "Add user"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Name">
          <Input required autoFocus={!user} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Mobile number" hint="They log in with this number">
          <Input
            type="tel"
            inputMode="tel"
            required
            maxLength={16}
            placeholder="98765 43210"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </Field>
        <Field label="Access" hint={ROLE_HINT[role]}>
          {isMe ? (
            <p className="text-sm">{ROLE_LABEL[role]} (you can&apos;t change your own access)</p>
          ) : (
            <Segmented value={role} options={ROLES} onChange={setRole} />
          )}
        </Field>
        <Field
          label={user ? "New PIN" : "PIN"}
          hint={
            user
              ? "Leave blank to keep their PIN. A new PIN logs them out everywhere; tell them the new one."
              : "4 to 6 digits. Tell them their PIN; they can change it from the menu."
          }
        >
          <Input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            required={!user}
            pattern="\d{4,6}"
            minLength={4}
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            className="tracking-[0.3em]"
          />
        </Field>
        {user && !isMe && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Can log in (untick to turn off their access)
          </label>
        )}
        <ErrorBox error={error} />
        <div className="flex items-center gap-2">
          {user && !isMe && (
            <Button type="button" variant="ghost" className="text-red-600 dark:text-red-400" onClick={remove} disabled={busy}>
              Remove
            </Button>
          )}
          <Button type="submit" className="ml-auto" disabled={busy}>
            {busy ? "Saving…" : user ? "Save" : "Add user"}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

export default function UsersPage() {
  const { user: me, isAdmin } = useAuth();
  const { data: users, error, mutate } = useSWR<UserRow[]>(isAdmin ? "/users" : null);
  const [editing, setEditing] = useState<UserRow | "new" | null>(null);

  if (!isAdmin) return <p className="text-sm text-muted">Only admins can manage users.</p>;
  if (error) return <ErrorBox error={error} />;
  if (!users) return <Loading />;

  const status = (u: UserRow) => {
    if (!u.active) return <Badge tone="red">Turned off</Badge>;
    if (u.lockedUntil && new Date(u.lockedUntil) > new Date()) return <Badge tone="amber">Locked (wrong PINs)</Badge>;
    return null;
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        title="Users"
        subtitle="Who can log in to the app"
        actions={<Button onClick={() => setEditing("new")}>+ Add user</Button>}
      />
      <Card>
        <ul className="divide-y divide-border">
          {users.map((u) => (
            <li key={u.id}>
              <button
                onClick={() => setEditing(u)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2"
              >
                <div className="min-w-0 flex-1">
                  <p className={`truncate font-medium ${u.active ? "" : "text-muted line-through"}`}>
                    {u.name}
                    {u.id === me.id && <span className="ml-1 text-xs font-normal text-muted">(you)</span>}
                  </p>
                  <p className="text-xs text-muted">
                    {formatPhone(u.phone)} · {u.lastLoginAt ? `last login ${formatDay(u.lastLoginAt.slice(0, 10))}` : "never logged in"}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge tone={u.role === "ADMIN" ? "brand" : "neutral"}>{ROLE_LABEL[u.role]}</Badge>
                  {status(u)}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </Card>
      <p className="text-xs text-muted">
        <strong>Admin</strong>: {ROLE_HINT.ADMIN.toLowerCase()}. <strong>View only</strong>: {ROLE_HINT.VIEWER.toLowerCase()}.
        Someone who forgets their PIN: open them here and set a new one.
      </p>
      {editing && (
        <UserSheet
          user={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => mutate()}
        />
      )}
    </div>
  );
}
