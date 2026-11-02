"use client";

import { PageHeader } from "@/components/ui";
import { ProductList } from "@/components/products/ProductList";

export default function ProductsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <PageHeader title="Products" />
      <ProductList />
    </div>
  );
}
