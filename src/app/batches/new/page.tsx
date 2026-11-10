"use client";

import { BatchStartForm } from "@/components/batches/BatchStartForm";
import { PageHeader } from "@/components/ui";

export default function NewBatchPage() {
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Start batch" back="/batches/" subtitle="The raw materials come out of stock on the start day" />
      <BatchStartForm />
    </div>
  );
}
