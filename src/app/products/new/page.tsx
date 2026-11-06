"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import useSWR from "swr";
import { ErrorBox, Loading, PageHeader } from "@/components/ui";
import { ProductForm } from "@/components/products/ProductForm";
import type { ProductDetail } from "@/lib/products";

/**
 * New product; `?from=<id>` starts from a copy of that product (Duplicate). With `?group=<id>` it's
 * a new size of that product group (copied from `from`, one of its sizes).
 */
function NewProduct() {
  const params = useSearchParams();
  const from = params.get("from");
  const group = params.get("group");
  const { data: template, error } = useSWR<ProductDetail>(from ? `/products/${from}` : null);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={group ? `New size of ${template?.group?.name ?? "…"}` : template ? "Duplicate product" : "Add product"}
        subtitle={
          group
            ? "Everything is copied from the size you came from. Change the size values and whatever differs."
            : template
              ? "Everything is copied. Change the name (and code) and whatever differs."
              : undefined
        }
        back={group ? `/products/group/?id=${group}` : from ? `/products/detail/?id=${from}` : "/products/"}
      />
      <ErrorBox error={error} />
      {from && !template && !error && <Loading />}
      {(!from || template) && <ProductForm template={template} groupId={group ? Number(group) : undefined} />}
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
