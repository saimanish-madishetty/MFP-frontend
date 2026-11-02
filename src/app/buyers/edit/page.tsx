"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import useSWR from "swr";
import { ErrorBox, Loading, PageHeader } from "@/components/ui";
import { BuyerForm } from "@/components/buyers/BuyerForm";
import type { BuyerDetail } from "@/lib/buyers";

function EditBuyer() {
  const id = useSearchParams().get("id");
  const { data, error } = useSWR<BuyerDetail>(id ? `/buyers/${id}` : null);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={data ? `Edit ${data.name}` : "Edit buyer"} back={`/buyers/detail/?id=${id}`} />
      <ErrorBox error={error} />
      {!data && !error && <Loading />}
      {data && <BuyerForm buyer={data} />}
    </div>
  );
}

export default function EditBuyerPage() {
  return (
    <Suspense fallback={<Loading />}>
      <EditBuyer />
    </Suspense>
  );
}
