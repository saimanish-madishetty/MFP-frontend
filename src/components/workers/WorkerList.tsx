"use client";

import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { formatINR } from "@/lib/format";
import { rateLabel, type WorkerWithSummary } from "@/lib/workers";
import { Badge, ButtonLink, Empty, ErrorBox, Loading } from "@/components/ui";
import { WorkerGroup } from "./WorkerGroup";

export function PayableAmount({ payable }: { payable: string }) {
  const n = Number(payable);
  if (n < 0) return <span className="text-red-600 dark:text-red-400">Owes {formatINR(-n)}</span>;
  return <span>{formatINR(n)}</span>;
}

export function WorkerList() {
  const [showArchived, setShowArchived] = useState(false);
  const { data, error, isLoading } = useSWR<WorkerWithSummary[]>(
    `/workers${showArchived ? "?includeInactive=true" : ""}`,
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          Show archived
        </label>
        <ButtonLink href="/workers/new/">+ Add worker</ButtonLink>
      </div>

      <ErrorBox error={error} />
      {isLoading && <Loading />}
      {data?.length === 0 && <Empty>No workers yet. Add your first worker to start marking attendance.</Empty>}

      {data && data.length > 0 &&
        [
          { title: "Permanent", workers: data.filter((w) => w.permanent) },
          { title: "Temporary", workers: data.filter((w) => !w.permanent) },
        ].map((g) => (
          <WorkerGroup
            key={g.title}
            title={g.title}
            items={g.workers}
            fields={(w) => [w.name, w.role, w.phone]}
            heightClass="max-h-104"
            listClassName="grid gap-2 sm:grid-cols-2"
          >
            {(w) => (
          <li key={w.id}>
            <Link
              href={`/workers/detail/?id=${w.id}`}
              className="block rounded-xl border border-border bg-surface p-4 hover:border-brand"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{w.name}</p>
                  <p className="truncate text-xs text-muted">{w.role || rateLabel(w)}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {!w.active && <Badge>Archived</Badge>}
                  {w.active && <Badge tone={w.permanent ? "blue" : "neutral"}>{w.permanent ? "Permanent" : "Temporary"}</Badge>}
                  {w.active && w.summary.payDue && <Badge tone="amber">Pay due</Badge>}
                </div>
              </div>
              <div className="mt-3 flex items-end justify-between">
                <span className="text-xs text-muted">
                  {w.summary.daysWorked} day{w.summary.daysWorked === 1 ? "" : "s"} this period
                </span>
                <span className="text-lg font-semibold tabular-nums">
                  <PayableAmount payable={w.summary.payable} />
                </span>
              </div>
            </Link>
          </li>
            )}
          </WorkerGroup>
        ))}
    </div>
  );
}
