import { PageHeader } from "@/components/ui";
import { BuyerForm } from "@/components/buyers/BuyerForm";

export default function NewBuyerPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Add buyer" back="/buyers/" />
      <BuyerForm />
    </div>
  );
}
