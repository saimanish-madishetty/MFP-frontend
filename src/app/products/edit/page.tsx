"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import useSWR from "swr";
import { ErrorBox, Loading, PageHeader } from "@/components/ui";
import { ProductForm } from "@/components/products/ProductForm";
import type { ProductDetail } from "@/lib/products";

function EditProduct() {
  const id = useSearchParams().get("id");
  const { data, error } = useSWR<ProductDetail>(id ? `/products/${id}` : null);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={data ? `Edit ${data.internalName}` : "Edit product"} back={`/products/detail/?id=${id}`} />
      <ErrorBox error={error} />
      {!data && !error && <Loading />}
      {data && <ProductForm product={data} />}
    </div>
  );
}

export default function EditProductPage() {
  return (
    <Suspense fallback={<Loading />}>
      <EditProduct />
    </Suspense>
  );
}
