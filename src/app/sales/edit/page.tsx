"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import useSWR from "swr";
import { ErrorBox, Loading, PageHeader } from "@/components/ui";
import { SaleForm } from "@/components/sales/SaleForm";
import type { SaleDetail } from "@/lib/sales";

function EditSale() {
  const id = useSearchParams().get("id");
  const { data, error } = useSWR<SaleDetail>(id ? `/sales/${id}` : null);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={data ? `Edit ${data.invoiceNumber}` : "Edit invoice"}
        subtitle="The invoice number stays the same."
        back={`/sales/detail/?id=${id}`}
      />
      <ErrorBox error={error} />
      {!data && !error && <Loading />}
      {data && <SaleForm sale={data} />}
    </div>
  );
}

export default function EditSalePage() {
  return (
    <Suspense fallback={<Loading />}>
      <EditSale />
    </Suspense>
  );
}
