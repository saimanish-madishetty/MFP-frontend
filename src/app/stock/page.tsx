"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { MaterialList } from "@/components/stock/MaterialList";
import { ProductList } from "@/components/products/ProductList";
import { Loading, PageHeader, Segmented } from "@/components/ui";

type Tab = "raw" | "supply" | "products";

function StockHome() {
  const router = useRouter();
  const param = useSearchParams().get("tab");
  // Products is the first tab and the default (/stock/).
  const tab: Tab = param === "raw" || param === "supply" ? param : "products";

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Stock" />
      <div className="mb-4">
        <Segmented<Tab>
          value={tab}
          onChange={(t) => router.replace(t === "products" ? "/stock/" : `/stock/?tab=${t}`)}
          options={[
            { value: "products", label: "Products" },
            { value: "raw", label: "Raw materials" },
            { value: "supply", label: "Supplies" },
          ]}
        />
      </div>
      {tab === "products" ? <ProductList /> : <MaterialList type={tab === "raw" ? "RAW" : "SUPPLY"} />}
    </div>
  );
}

export default function StockPage() {
  return (
    <Suspense fallback={<Loading />}>
      <StockHome />
    </Suspense>
  );
}
