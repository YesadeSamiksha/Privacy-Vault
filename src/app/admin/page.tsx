import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatStatus, getStatusTheme, getDaysRemainingTheme, formatDate, getDaysRemaining } from "@/lib/utils";
import { StatusFilter } from "./status-filter";

export const dynamic = "force-dynamic";

function RiskDonutChart({ high, med, low }: { high: number; med: number; low: number }) {
  const total = high + med + low;
  const r = 50;
  const circumference = 2 * Math.PI * r; // ~314.16
  
  const pHigh = total > 0 ? high / total : 0;
  const pMed = total > 0 ? med / total : 0;
  const pLow = total > 0 ? low / total : 0;

  const dashHigh = circumference * pHigh;
  const dashMed = circumference * pMed;
  const dashLow = circumference * pLow;

  const offsetHigh = 0;
  const offsetMed = -dashHigh;
  const offsetLow = -(dashHigh + dashMed);

  return (
    <div className="flex flex-col sm:flex-row items-center gap-8 justify-center sm:justify-start">
      <div className="relative w-36 h-36">
        <svg viewBox="0 0 160 160" className="w-full h-full transform -rotate-90">
          {/* Base track */}
          <circle cx="80" cy="80" r={r} fill="transparent" stroke="var(--border)" strokeWidth="12" className="opacity-30" />
          
          {total === 0 ? (
            <circle cx="80" cy="80" r={r} fill="transparent" stroke="var(--muted-foreground)" strokeWidth="12" strokeDasharray={`${circumference} ${circumference}`} />
          ) : (
            <>
              {/* Low Risk Segment (Green) */}
              {low > 0 && (
                <circle
                  cx="80"
                  cy="80"
                  r={r}
                  fill="transparent"
                  stroke="oklch(0.723 0.176 148.25)"
                  strokeWidth="12"
                  strokeDasharray={`${dashLow} ${circumference}`}
                  strokeDashoffset={offsetLow}
                  className="transition-all duration-500"
                />
              )}
              {/* Medium Risk Segment (Amber) */}
              {med > 0 && (
                <circle
                  cx="80"
                  cy="80"
                  r={r}
                  fill="transparent"
                  stroke="oklch(0.769 0.188 70.08)"
                  strokeWidth="12"
                  strokeDasharray={`${dashMed} ${circumference}`}
                  strokeDashoffset={offsetMed}
                  className="transition-all duration-500"
                />
              )}
              {/* High Risk Segment (Red) */}
              {high > 0 && (
                <circle
                  cx="80"
                  cy="80"
                  r={r}
                  fill="transparent"
                  stroke="oklch(0.577 0.245 27.325)"
                  strokeWidth="12"
                  strokeDasharray={`${dashHigh} ${circumference}`}
                  strokeDashoffset={offsetHigh}
                  className="transition-all duration-500"
                />
              )}
            </>
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold font-mono text-foreground">{total}</span>
          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Total</span>
        </div>
      </div>
      <div className="space-y-2 text-sm w-full sm:w-auto">
        <div className="flex items-center gap-3">
          <div className="w-3.5 h-3.5 rounded bg-[oklch(0.577_0.245_27.325)]" />
          <span className="font-semibold text-muted-foreground w-16">High Risk:</span>
          <span className="font-mono font-bold text-foreground">{high}</span>
          <span className="text-xs text-muted-foreground/60 font-medium">({total > 0 ? Math.round(pHigh * 100) : 0}%)</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-3.5 h-3.5 rounded bg-[oklch(0.769_0.188_70.08)]" />
          <span className="font-semibold text-muted-foreground w-16">Medium:</span>
          <span className="font-mono font-bold text-foreground">{med}</span>
          <span className="text-xs text-muted-foreground/60 font-medium">({total > 0 ? Math.round(pMed * 100) : 0}%)</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-3.5 h-3.5 rounded bg-[oklch(0.723_0.176_148.25)]" />
          <span className="font-semibold text-muted-foreground w-16">Low Risk:</span>
          <span className="font-mono font-bold text-foreground">{low}</span>
          <span className="text-xs text-muted-foreground/60 font-medium">({total > 0 ? Math.round(pLow * 100) : 0}%)</span>
        </div>
      </div>
    </div>
  );
}

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
    supabase.from("dsar_requests").select("status, deadline, risk_score, data_categories"),
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

  const riskCounts = {
    High: all.filter((r) => r.risk_score === "High").length,
    Medium: all.filter((r) => r.risk_score === "Medium").length,
    Low: all.filter((r) => r.risk_score === "Low" || !r.risk_score).length,
  };

  const categoryCounts: Record<string, number> = {};
  let requestsWithCategories = 0;
  all.forEach((r) => {
    if (r.data_categories && Array.isArray(r.data_categories) && r.data_categories.length > 0) {
      requestsWithCategories++;
      r.data_categories.forEach((cat: string) => {
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      });
    }
  });

  const sortedCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const adminName = adminRow?.name ?? user.email;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-border">
        <div>
          <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
            <svg className="w-9 h-9 text-primary animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Compliance Control Center
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">Welcome back, <span className="font-semibold text-foreground">{adminName}</span></p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <StatsCard title="Total Requests" value={all.length} />
        <StatsCard title="Urgent Compliance" value={stats.urgent} highlight="red" />
        <StatsCard title="Active Processing" value={stats.processing + stats.underReview} highlight="blue" />
        <StatsCard title="Successfully Closed" value={stats.completed} highlight="green" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 pt-4">
        <Card className="lg:col-span-2 shadow-sm border border-border">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Privacy Risk Profile</CardTitle>
            <CardDescription>Request distribution by threat level.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center min-h-[160px] pb-6">
            <RiskDonutChart high={riskCounts.High} med={riskCounts.Medium} low={riskCounts.Low} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 shadow-sm border border-border">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Data Category Exposure</CardTitle>
            <CardDescription>Top data types exposed in matching systems.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pb-6">
            {sortedCategories.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No matching categories cataloged yet. Complete requests to view metrics.
              </div>
            ) : (
              sortedCategories.map(([category, count]) => {
                const percentage = requestsWithCategories > 0 ? Math.round((count / all.length) * 100) : 0;
                return (
                  <div key={category} className="space-y-1.5">
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-semibold text-muted-foreground">{category}</span>
                      <span className="font-mono font-bold text-foreground">{count} ({percentage}%)</span>
                    </div>
                    <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-1000"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-between items-center pt-8 border-t border-border">
        <h2 className="text-2xl font-semibold flex items-center gap-2 text-foreground">
          <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          DSAR Registry
        </h2>
        <StatusFilter current={status ?? ""} />
      </div>

      <Card className="overflow-hidden shadow-sm border border-border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-secondary/40 text-muted-foreground border-b border-border">
              <tr>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-[11px]">Token / User</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-[11px]">Request Type</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-[11px]">Risk</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-[11px]">Status</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-[11px] text-right">SLA Target / Left</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-background">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-3">
                      <svg className="w-12 h-12 text-muted-foreground/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                      </svg>
                      <p className="text-base font-medium">No requests found matching search criteria.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((req) => {
                  const daysRemaining = getDaysRemaining(req.deadline);
                  const isUrgent = req.status !== "completed" && req.status !== "rejected" && daysRemaining !== null && daysRemaining < 7;
                  
                  return (
                    <tr key={req.id} className="table-row-hover group cursor-pointer border-b border-border last:border-0">
                      <td className="px-6 py-5">
                        <Link href={`/admin/requests/${req.id}`} className="block group-hover:translate-x-1 transition-transform duration-200">
                          <div className="font-mono font-bold text-primary group-hover:underline flex items-center gap-2 text-base">
                            {req.token}
                            <svg className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                          <div className="text-muted-foreground text-xs mt-1 flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            {req.user_name}
                          </div>
                        </Link>
                      </td>
                      <td className="px-6 py-5">
                        <span className="capitalize font-semibold text-foreground/80">{req.request_type}</span>
                      </td>
                      <td className="px-6 py-5">
                        <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${
                          req.risk_score === "High" ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/50" :
                          req.risk_score === "Medium" ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50" :
                          "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900/50"
                        }`}>
                          {req.risk_score || "Low"}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <span className={`px-3 py-1.5 rounded-full text-xs font-semibold border shadow-sm ${getStatusTheme(req.status)}`}>
                          {formatStatus(req.status)}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="font-semibold text-foreground">{formatDate(req.deadline)}</div>
                        {req.status !== "completed" && req.status !== "rejected" ? (
                          <div className={`text-xs mt-1 font-bold flex items-center justify-end gap-1 ${getDaysRemainingTheme(daysRemaining)}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${isUrgent ? 'bg-red-500 animate-ping' : daysRemaining !== null && daysRemaining < 15 ? 'bg-amber-500' : 'bg-green-500'}`} />
                            {daysRemaining} days left
                          </div>
                        ) : (
                          <div className="text-xs mt-1 text-muted-foreground italic">
                            Resolved
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
  let bgGradient = "from-card to-card";
  let iconColor = "text-muted-foreground";
  let icon = <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />;
  
  if (highlight === "red" && value > 0) {
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
