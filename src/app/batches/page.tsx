"use client";

import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import type { BatchListItem, BatchStatus } from "@/lib/batches";
import type { Product } from "@/lib/products";
import { BatchCard } from "@/components/batches/BatchCard";
import { ButtonLink, Empty, ErrorBox, Loading, PageHeader, Segmented } from "@/components/ui";

/** Batches in process (started, not packed yet), and finished or cancelled ones. */
export default function BatchesPage() {
  const [status, setStatus] = useState<BatchStatus>("OPEN");
  const { data: batches, error } = useSWR<BatchListItem[]>(`/batches?status=${status}`);
  const { data: products } = useSWR<Product[]>("/products?includeInactive=true");
  const productById = new Map((products ?? []).map((p) => [p.id, p]));

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        title="Batches"
        subtitle={
          <>
            Production from the mixer to the packet ·{" "}
            <Link href="/batches/plans/" className="text-brand">
              Batch plans ›
            </Link>
          </>
        }
        actions={<ButtonLink href="/batches/new/">+ Start batch</ButtonLink>}
      />
      <Segmented
        value={status}
        onChange={setStatus}
        options={[
          { value: "OPEN", label: "In process" },
          { value: "FINISHED", label: "Finished" },
          { value: "CANCELLED", label: "Cancelled" },
        ]}
      />
      <ErrorBox error={error} />
      {!batches ? (
        !error && <Loading />
      ) : batches.length === 0 ? (
        <Empty>
          {status === "OPEN"
            ? "No batches in process. Start one when the mixer is loaded."
            : status === "FINISHED"
              ? "No finished batches yet."
              : "No cancelled batches."}
        </Empty>
      ) : (
        <div className="space-y-2">
          {batches.map((b) => (
            <BatchCard key={b.id} batch={b} productById={productById} />
          ))}
        </div>
      )}
    </div>
  );
}
