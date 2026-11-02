"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { DayEndEntry } from "@/components/stock/DayEndEntry";
import { Loading, PageHeader } from "@/components/ui";
import { todayIST } from "@/lib/format";

/** Day-end production: products made (added to Stock → Products) and materials used. Opened from the dashboard. */
function ProductionHome() {
  const params = useSearchParams();
  const [date, setDate] = useState(() => params.get("date") ?? todayIST());

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Production" back="/" subtitle="Products made and materials used" />
      <DayEndEntry key={date} date={date} onDateChange={setDate} />
    </div>
  );
}

export default function ProductionPage() {
  return (
    <Suspense fallback={<Loading />}>
      <ProductionHome />
    </Suspense>
  );
}
