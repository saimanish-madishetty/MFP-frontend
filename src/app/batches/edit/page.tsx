"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import useSWR from "swr";
import type { BatchDetail } from "@/lib/batches";
import { BatchStartForm } from "@/components/batches/BatchStartForm";
import { ErrorBox, Loading, PageHeader } from "@/components/ui";

function EditBatch() {
  const id = useSearchParams().get("id");
  const { data: batch, error } = useSWR<BatchDetail>(id ? `/batches/${id}` : null);
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Edit batch" back={`/batches/detail/?id=${id}`} />
      <ErrorBox error={error} />
      {batch ? (
        batch.status === "OPEN" ? (
          <BatchStartForm batch={batch} />
        ) : (
          <ErrorBox error="Only a batch in process can be changed." />
        )
      ) : (
        !error && <Loading />
      )}
    </div>
  );
}

export default function EditBatchPage() {
  return (
    <Suspense fallback={<Loading />}>
      <EditBatch />
    </Suspense>
  );
}
