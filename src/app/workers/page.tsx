"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AttendanceDay } from "@/components/workers/AttendanceDay";
import { WorkerList } from "@/components/workers/WorkerList";
import { Loading, PageHeader, Segmented } from "@/components/ui";
import { todayIST } from "@/lib/format";

type Tab = "attendance" | "list";

function WorkersHome() {
  const router = useRouter();
  const params = useSearchParams();
  const tab: Tab = params.get("tab") === "list" ? "list" : "attendance";
  const [date, setDate] = useState(todayIST);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Workers" />
      <div className="mb-4">
        <Segmented<Tab>
          value={tab}
          onChange={(t) => router.replace(t === "list" ? "/workers/?tab=list" : "/workers/")}
          options={[
            { value: "attendance", label: "Attendance" },
            { value: "list", label: "Workers & pay" },
          ]}
        />
      </div>
      {tab === "attendance" ? <AttendanceDay key={date} date={date} onDateChange={setDate} /> : <WorkerList />}
    </div>
  );
}

export default function WorkersPage() {
  return (
    <Suspense fallback={<Loading />}>
      <WorkersHome />
    </Suspense>
  );
}
