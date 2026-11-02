import { PageHeader } from "@/components/ui";
import { ProductForm } from "@/components/products/ProductForm";

export default function NewProductPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Add product" back="/products/" />
      <ProductForm />
    </div>
  );
}
