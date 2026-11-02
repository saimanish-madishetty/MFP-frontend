"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Loading, PageHeader } from "@/components/ui";
import { MaterialForm } from "@/components/stock/MaterialForm";

function NewMaterial() {
  const type = useSearchParams().get("type") === "SUPPLY" ? "SUPPLY" : "RAW";
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Add material" back="/stock/" />
      <MaterialForm defaultType={type} />
    </div>
  );
}

export default function NewMaterialPage() {
  return (
    <Suspense fallback={<Loading />}>
      <NewMaterial />
    </Suspense>
  );
}
