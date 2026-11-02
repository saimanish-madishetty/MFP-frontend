"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import useSWR from "swr";
import { ErrorBox, Loading, PageHeader } from "@/components/ui";
import { MaterialForm } from "@/components/stock/MaterialForm";
import type { MaterialDetail } from "@/lib/stock";

function EditMaterial() {
  const id = useSearchParams().get("id");
  const { data, error } = useSWR<MaterialDetail>(id ? `/materials/${id}` : null);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={data ? `Edit ${data.name}` : "Edit material"} back={`/stock/detail/?id=${id}`} />
      <ErrorBox error={error} />
      {!data && !error && <Loading />}
      {data && <MaterialForm material={data} />}
    </div>
  );
}

export default function EditMaterialPage() {
  return (
    <Suspense fallback={<Loading />}>
      <EditMaterial />
    </Suspense>
  );
}
