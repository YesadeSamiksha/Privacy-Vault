import { createClient } from "@/lib/supabase-server";
import { getDaysRemaining } from "@/lib/utils";
import { PrintButton } from "./print-button";

export const revalidate = 60;

export default async function CompliancePage() {
  const supabase = await createClient();
  const { data: all } = await supabase
    .from("dsar_requests")
    .select("status, deadline, created_at, completed_at, request_type");

  const rows = all ?? [];
  const total = rows.length;
  const completed = rows.filter((r) => r.status === "completed").length;
  const rejected = rows.filter((r) => r.status === "rejected").length;
  const submitted = rows.filter((r) => r.status === "submitted").length;
  const underReview = rows.filter((r) => r.status === "under_review").length;
  const processing = rows.filter((r) => r.status === "processing").length;

  const overdue = rows.filter((r) => {
    if (r.status === "completed" || r.status === "rejected") return false;
    const d = getDaysRemaining(r.deadline);
    return d !== null && d < 0;
  }).length;

  const completedWithDates = rows.filter((r) => r.status === "completed" && r.completed_at && r.created_at);
  let averageResolutionDays: number | null = null;
  if (completedWithDates.length > 0) {
    const totalDays = completedWithDates.reduce((acc, r) => {
      return acc + Math.ceil((new Date(r.completed_at!).getTime() - new Date(r.created_at).getTime()) / 86400000);
    }, 0);
    averageResolutionDays = Math.round(totalDays / completedWithDates.length);
  }

  let complianceScore = 100;
  if (total > 0) {
    const overdueRate = overdue / total;
    const completionRate = (completed + rejected) / total;
    complianceScore = Math.max(0, Math.round(completionRate * 70 + (1 - overdueRate) * 30));
  }

  const reportGeneratedAt = new Date().toLocaleString();

  return (
    <div className="max-w-5xl mx-auto space-y-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 border-b border-border pb-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">Public Compliance Report</h1>
          <p className="text-lg text-muted-foreground">Transparency metrics under the Digital Personal Data Protection Act, 2023.</p>
        </div>
        <PrintButton />
      </div>

      <div className="bg-primary text-primary-foreground p-8 sm:p-12 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-8">
        <div className="space-y-2 text-center sm:text-left">
          <h2 className="text-2xl font-semibold opacity-90">Overall Compliance Score</h2>
          <p className="text-sm opacity-75 max-w-md leading-relaxed">
            Calculated based on adherence to statutory resolution timelines across all verified data subject requests.
          </p>
        </div>
        <div className="text-7xl sm:text-8xl font-bold tracking-tighter">{complianceScore}%</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <StatBox label="Total Requests" value={total} />
        <StatBox label="Completed" value={completed} color="green" />
        <StatBox label="Avg. Resolution" value={averageResolutionDays} suffix="days" />
      </div>

      <div className="grid md:grid-cols-2 gap-12 pt-8">
        <div className="space-y-6">
          <h3 className="text-xl font-bold border-b border-border pb-4">Requests by Type</h3>
          <div className="space-y-4">
            <StatRow label="Right to Access" value={rows.filter((r) => r.request_type === "access").length} total={total} />
            <StatRow label="Right to Correction" value={rows.filter((r) => r.request_type === "correction").length} total={total} />
            <StatRow label="Right to Erasure" value={rows.filter((r) => r.request_type === "erasure").length} total={total} />
          </div>
        </div>
        <div className="space-y-6">
          <h3 className="text-xl font-bold border-b border-border pb-4">Current Status</h3>
          <div className="space-y-4">
            <StatRow label="Submitted" value={submitted} />
            <StatRow label="Processing / Under Review" value={processing + underReview} />
            <StatRow label="Completed Successfully" value={completed} />
            <StatRow label="Rejected / Invalid" value={rejected} />
            <div className="pt-2 mt-2 border-t border-dashed border-border">
              <StatRow label="Currently Overdue" value={overdue} highlight />
            </div>
          </div>
        </div>
      </div>

      <div className="pt-12 text-center text-xs text-muted-foreground">
        Report automatically generated on {reportGeneratedAt}
      </div>
    </div>
  );
}

function StatBox({ label, value, color, suffix }: { label: string; value: number | null; color?: string; suffix?: string }) {
  return (
    <div className="border border-border p-8 rounded-sm">
      <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest mb-4">{label}</p>
      <p className={`text-5xl font-bold ${color === "green" ? "text-green-600" : ""}`}>
        {value ?? "--"}
        {suffix && <span className="text-xl font-medium text-muted-foreground ml-2 lowercase">{suffix}</span>}
      </p>
    </div>
  );
}

function StatRow({ label, value, total, highlight }: { label: string; value: number; total?: number; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center py-2">
      <span className={`font-medium ${highlight ? "text-destructive font-bold" : "text-foreground"}`}>{label}</span>
      <div className="flex items-center gap-4">
        <span className={`text-xl font-semibold ${highlight ? "text-destructive" : ""}`}>{value}</span>
        {total !== undefined && total > 0 && (
          <span className="text-sm text-muted-foreground w-12 text-right">{Math.round((value / total) * 100)}%</span>
        )}
      </div>
    </div>
  );
}
