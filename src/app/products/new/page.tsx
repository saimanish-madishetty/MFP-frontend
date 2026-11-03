"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import useSWR from "swr";
import { ErrorBox, Loading, PageHeader } from "@/components/ui";
import { ProductForm } from "@/components/products/ProductForm";
import type { ProductDetail } from "@/lib/products";

/** New product; `?from=<id>` starts from a copy of that product (Duplicate). */
function NewProduct() {
  const from = useSearchParams().get("from");
  const { data: template, error } = useSWR<ProductDetail>(from ? `/products/${from}` : null);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={template ? `New size of ${template.publicName}` : "Add product"}
        subtitle={template ? "Everything is copied. Change the name (and code) and whatever differs." : undefined}
        back={from ? `/products/detail/?id=${from}` : "/products/"}
      />
      <ErrorBox error={error} />
      {from && !template && !error && <Loading />}
      {(!from || template) && <ProductForm template={template} />}
    </div>
  );
}

export default function NewProductPage() {
  return (
    <Suspense fallback={<Loading />}>
      <NewProduct />
    </Suspense>
  );
}
