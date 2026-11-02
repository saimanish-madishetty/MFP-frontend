import { PageHeader } from "@/components/ui";
import { WorkerForm } from "@/components/workers/WorkerForm";

export default function NewWorkerPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Add worker" back="/workers/?tab=list" />
      <WorkerForm />
    </div>
  );
}
