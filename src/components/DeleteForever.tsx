"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { api } from "@/lib/api";
import { useCanEdit } from "@/lib/use-auth";
import { Button, ErrorBox, Sheet } from "@/components/ui";

/**
 * "Delete permanently" button with a confirmation sheet. Calls DELETE `path`, refreshes the
 * matching data and goes to `then`. Errors (e.g. "on an invoice, archive instead") show in the sheet.
 */
export function DeleteForever({
  name,
  path,
  then,
  refresh,
  children,
}: {
  name: string;
  path: string;
  then: string;
  refresh: (key: string) => boolean;
  /** What gets deleted, shown in the sheet */
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const canEdit = useCanEdit();

  const remove = async () => {
    setDeleting(true);
    setError(null);
    try {
      await api(path, "DELETE");
      mutate((k) => typeof k === "string" && refresh(k));
      router.replace(then);
    } catch (e) {
      setError(e);
      setDeleting(false);
    }
  };

  if (!canEdit) return null;
  return (
    <>
      <Button variant="ghost" size="sm" className="text-red-600 dark:text-red-400" onClick={() => setOpen(true)}>
        Delete permanently
      </Button>
      <Sheet open={open} title={`Delete ${name}?`} onClose={() => !deleting && setOpen(false)}>
        <div className="space-y-2 text-sm">
          {children}
          <p className="text-muted">It can&apos;t be undone. To keep the history, archive instead.</p>
        </div>
        <div className="mt-3">
          <ErrorBox error={error} />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="danger" onClick={remove} disabled={deleting}>
            {deleting ? "Deleting…" : "Delete permanently"}
          </Button>
        </div>
      </Sheet>
    </>
  );
}
