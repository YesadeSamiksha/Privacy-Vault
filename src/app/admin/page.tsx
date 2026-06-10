import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { formatStatus, getStatusTheme, getDaysRemainingTheme, formatDate, getDaysRemaining } from "@/lib/utils";
import { StatusFilter } from "./status-filter";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const { status } = await searchParams;
  const validStatuses = ["submitted", "under_review", "processing", "completed", "rejected"];

  let query = supabase.from("dsar_requests").select("*").order("created_at", { ascending: false });
  if (status && validStatuses.includes(status)) {
    query = query.eq("status", status);
  }

  const [{ data: requests }, { data: allRequests }, { data: adminRow }] = await Promise.all([
    query,
    supabase.from("dsar_requests").select("status, deadline"),
    supabase.from("admins").select("name").eq("id", user.id).single(),
  ]);

  const rows = requests ?? [];
  const all = allRequests ?? [];

  const stats = {
    submitted: all.filter((r) => r.status === "submitted").length,
    underReview: all.filter((r) => r.status === "under_review").length,
    processing: all.filter((r) => r.status === "processing").length,
    completed: all.filter((r) => r.status === "completed").length,
    rejected: all.filter((r) => r.status === "rejected").length,
    urgent: all.filter((r) => {
      if (r.status === "completed" || r.status === "rejected") return false;
      const d = getDaysRemaining(r.deadline);
      return d !== null && d < 7 && d >= 0;
    }).length,
  };

  const adminName = adminRow?.name ?? user.email;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-border">
        <div>
          <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
            <svg className="w-9 h-9 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Dashboard
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">Welcome back, <span className="font-semibold text-foreground">{adminName}</span></p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <StatsCard title="Total Requests" value={stats.submitted + stats.underReview + stats.processing + stats.completed + stats.rejected} />
        <StatsCard title="Urgent (< 7 Days)" value={stats.urgent} highlight="red" />
        <StatsCard title="Processing" value={stats.processing + stats.underReview} highlight="blue" />
        <StatsCard title="Completed" value={stats.completed} highlight="green" />
      </div>

      <div className="flex justify-between items-center pt-4">
        <h2 className="text-2xl font-semibold flex items-center gap-2">
          <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          All Requests
        </h2>
        <StatusFilter current={status ?? ""} />
      </div>

      <Card className="overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gradient-to-r from-secondary to-secondary/50 text-muted-foreground border-b-2 border-border">
              <tr>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Token / User</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Type</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Status</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs text-right">Deadline / SLA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-white">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-3">
                      <svg className="w-12 h-12 text-muted-foreground/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                      </svg>
                      <p className="text-base font-medium">No requests found.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((req) => {
                  const daysRemaining = getDaysRemaining(req.deadline);
                  return (
                    <tr key={req.id} className="table-row-hover group cursor-pointer">
                      <td className="px-6 py-5">
                        <Link href={`/admin/requests/${req.id}`} className="block group-hover:translate-x-1 transition-transform duration-200">
                          <div className="font-mono font-semibold text-primary group-hover:underline flex items-center gap-2">
                            {req.token}
                            <svg className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                          <div className="text-muted-foreground text-xs mt-1.5 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            {req.user_name}
                          </div>
                        </Link>
                      </td>
                      <td className="px-6 py-5">
                        <span className="capitalize font-medium text-foreground/80">{req.request_type}</span>
                      </td>
                      <td className="px-6 py-5">
                        <span className={`px-3 py-1.5 rounded-full text-xs font-semibold border shadow-sm ${getStatusTheme(req.status)}`}>
                          {formatStatus(req.status)}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="font-semibold text-foreground">{formatDate(req.deadline)}</div>
                        {req.status !== "completed" && req.status !== "rejected" && (
                          <div className={`text-xs mt-1.5 font-bold flex items-center justify-end gap-1 ${getDaysRemainingTheme(daysRemaining)}`}>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {daysRemaining} days left
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function StatsCard({ title, value, highlight }: { title: string; value: number; highlight?: "red" | "green" | "blue" }) {
  let colorClass = "text-foreground";
  let bgGradient = "from-gray-50 to-gray-100/50";
  let iconColor = "text-gray-500";
  let icon = <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />;
  
  if (highlight === "red" && value > 0) {
    colorClass = "text-red-600";
    bgGradient = "from-red-50 to-red-100/50";
    iconColor = "text-red-500";
    icon = <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />;
  }
  if (highlight === "green" && value > 0) {
    colorClass = "text-green-600";
    bgGradient = "from-green-50 to-green-100/50";
    iconColor = "text-green-500";
    icon = <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />;
  }
  if (highlight === "blue" && value > 0) {
    colorClass = "text-blue-600";
    bgGradient = "from-blue-50 to-blue-100/50";
    iconColor = "text-blue-500";
    icon = <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />;
  }
  
  return (
    <Card className={`stats-card-hover bg-gradient-to-br ${bgGradient} border-2`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-3">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{title}</p>
          <svg className={`w-5 h-5 ${iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {icon}
          </svg>
        </div>
        <p className={`text-4xl font-bold tracking-tight ${colorClass}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
