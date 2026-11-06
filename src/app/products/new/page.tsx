"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import useSWR from "swr";
import { ErrorBox, Loading, PageHeader, Segmented } from "@/components/ui";
import { MultiSizeForm } from "@/components/products/MultiSizeForm";
import { ProductForm } from "@/components/products/ProductForm";
import type { ProductDetail } from "@/lib/products";

/**
 * New product: one size, or several sizes at once. `?from=<id>` starts from a copy of that product
 * (Duplicate); with `?group=<id>` it's a new size of that product (copied from `from`, one of its sizes).
 */
function NewProduct() {
  const params = useSearchParams();
  const from = params.get("from");
  const group = params.get("group");
  const [several, setSeveral] = useState(false);
  const { data: template, error } = useSWR<ProductDetail>(from ? `/products/${from}` : null);
  const fresh = !from && !group;
  return (
    <div className="mx-auto max-w-2xl space-y-4">
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
      {fresh && (
        <div className="space-y-1">
          <Segmented<"one" | "several">
            value={several ? "several" : "one"}
            onChange={(v) => setSeveral(v === "several")}
            options={[
              { value: "one", label: "One size" },
              { value: "several", label: "Several sizes" },
            ]}
          />
          <p className="px-1 text-xs text-muted">
            {several
              ? "One product in different sizes, e.g. Maida Noodles in 1.5mm and 1.8mm. Each size has its own packing, price and stock."
              : "Comes in different sizes (thickness, weight, …)? Choose Several sizes."}
          </p>
        </div>
      )}
      <ErrorBox error={error} />
      {from && !template && !error && <Loading />}
      {fresh && several ? (
        <MultiSizeForm />
      ) : (
        (!from || template) && <ProductForm template={template} groupId={group ? Number(group) : undefined} />
      )}
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
