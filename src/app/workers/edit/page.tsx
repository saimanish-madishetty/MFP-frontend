"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import useSWR from "swr";
import { ErrorBox, Loading, PageHeader } from "@/components/ui";
import { WorkerForm } from "@/components/workers/WorkerForm";
import type { WorkerDetail } from "@/lib/workers";

function EditWorker() {
  const id = useSearchParams().get("id");
  const { data, error } = useSWR<WorkerDetail>(id ? `/workers/${id}` : null);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={data ? `Edit ${data.name}` : "Edit worker"} back={`/workers/detail/?id=${id}`} />
      <ErrorBox error={error} />
      {!data && !error && <Loading />}
      {data && <WorkerForm worker={data} />}
    </div>
  );
}

export default function EditWorkerPage() {
  return (
    <Suspense fallback={<Loading />}>
      <EditWorker />
    </Suspense>
  );
}
