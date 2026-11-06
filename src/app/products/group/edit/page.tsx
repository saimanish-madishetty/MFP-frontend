"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import useSWR from "swr";
import { ErrorBox, Loading, PageHeader } from "@/components/ui";
import { GroupForm } from "@/components/products/GroupForm";
import type { ProductGroup } from "@/lib/products";

/** `?id=<group>` edits a product with sizes; `?from=<product>` makes one starting from that product. */
function EditGroup() {
  const params = useSearchParams();
  const id = params.get("id");
  const from = params.get("from");
  const { data, error } = useSWR<ProductGroup>(id ? `/product-groups/${id}` : null);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={data ? `Edit ${data.name}` : "Make a product with sizes"}
        subtitle={
          id ? undefined : "Put the sizes of one product (thickness, weight, …) together. Stock, sales and history stay."
        }
        back={id ? `/products/group/?id=${id}` : from ? `/products/detail/?id=${from}` : "/products/"}
      />
      <ErrorBox error={error} />
      {id && !data && !error && <Loading />}
      {(!id || data) && <GroupForm group={data} fromId={from ? Number(from) : undefined} />}
    </div>
  );
}

export default function EditGroupPage() {
  return (
    <Suspense fallback={<Loading />}>
      <EditGroup />
    </Suspense>
  );
}
