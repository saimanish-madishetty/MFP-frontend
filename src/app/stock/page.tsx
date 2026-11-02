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
  const tab: Tab = param === "supply" || param === "products" ? param : "raw";

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Stock" />
      <div className="mb-4">
        <Segmented<Tab>
          value={tab}
          onChange={(t) => router.replace(t === "raw" ? "/stock/" : `/stock/?tab=${t}`)}
          options={[
            { value: "raw", label: "Raw materials" },
            { value: "supply", label: "Supplies" },
            { value: "products", label: "Products" },
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
