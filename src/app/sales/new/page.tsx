"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Loading, PageHeader } from "@/components/ui";
import { SaleForm } from "@/components/sales/SaleForm";

function NewSale() {
  const buyerId = Number(useSearchParams().get("buyerId")) || undefined;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New sale" back={buyerId ? `/buyers/detail/?id=${buyerId}` : "/sales/"} />
      <SaleForm initialBuyerId={buyerId} />
    </div>
  );
}

export default function NewSalePage() {
  return (
    <Suspense fallback={<Loading />}>
      <NewSale />
    </Suspense>
  );
}
