"use client";
import { useRouter, usePathname } from "next/navigation";

const statuses = [
  { value: "", label: "All Statuses" },
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under Review" },
  { value: "processing", label: "Processing" },
  { value: "completed", label: "Completed" },
  { value: "rejected", label: "Rejected" },
];

export function StatusFilter({ current }: { current: string }) {
  const router = useRouter();
  const pathname = usePathname();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    const url = val ? `${pathname}?status=${val}` : pathname;
    router.push(url);
  }

  return (
    <select
      className="h-9 px-3 py-1 text-sm border border-input rounded-sm bg-background"
      value={current}
      onChange={handleChange}
    >
      {statuses.map((s) => (
        <option key={s.value} value={s.value}>{s.label}</option>
      ))}
    </select>
  );
}
