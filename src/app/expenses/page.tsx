"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { BillList } from "@/components/expenses/BillList";
import { ExpenseList } from "@/components/expenses/ExpenseList";
import { Loading, PageHeader, Segmented } from "@/components/ui";

type Tab = "expenses" | "bills";

function ExpensesHome() {
  const router = useRouter();
  const tab: Tab = useSearchParams().get("tab") === "bills" ? "bills" : "expenses";

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Expenses" />
      <div className="mb-4">
        <Segmented<Tab>
          value={tab}
          onChange={(t) => router.replace(t === "bills" ? "/expenses/?tab=bills" : "/expenses/")}
          options={[
            { value: "expenses", label: "Expenses" },
            { value: "bills", label: "Bills" },
          ]}
        />
      </div>
      {tab === "bills" ? <BillList /> : <ExpenseList />}
    </div>
  );
}

export default function ExpensesPage() {
  return (
    <Suspense fallback={<Loading />}>
      <ExpensesHome />
    </Suspense>
  );
}
