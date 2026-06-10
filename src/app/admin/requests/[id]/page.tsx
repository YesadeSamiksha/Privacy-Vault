import { createClient } from "@/lib/supabase-server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatStatus, getStatusTheme, getDaysRemainingTheme, formatDateTime, getDaysRemaining } from "@/lib/utils";
import { AiSummary } from "./ai-summary";
import { ProcessorPropagation } from "./processor-propagation";

export const dynamic = "force-dynamic";

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const { id } = await params;
  const { data: req } = await supabase.from("dsar_requests").select("*").eq("id", id).single();
  if (!req) notFound();

  const daysRemaining = getDaysRemaining(req.deadline);
  const isUrgent = req.status !== "completed" && req.status !== "rejected" && daysRemaining !== null && daysRemaining < 7;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/admin" className="text-muted-foreground hover:text-primary transition-colors text-sm font-semibold flex items-center gap-2 hover:gap-3 transition-all">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </Link>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pb-6 border-b-2 border-border">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
            </div>
            <h1 className="text-4xl font-mono font-bold">{req.token}</h1>
            <span className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 shadow-sm ${getStatusTheme(req.status)}`}>
              {formatStatus(req.status)}
            </span>
            {isUrgent && (
              <span className="px-3 py-1.5 rounded-full text-xs font-bold border-2 border-red-300 bg-gradient-to-r from-red-100 to-red-200 text-red-900 shadow-sm animate-pulse">⚠ URGENT</span>
            )}
          </div>
          <p className="text-muted-foreground flex items-center gap-2 text-base">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Requested by <span className="font-semibold text-foreground">{req.user_name}</span> ({req.user_email})
          </p>
        </div>
        <div className="bg-secondary/50 p-4 rounded-sm border border-border flex flex-col gap-2 min-w-[200px]">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Current Status</p>
          <span className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 shadow-sm self-start ${getStatusTheme(req.status)}`}>
            {formatStatus(req.status)}
          </span>
          <p className="text-xs text-muted-foreground italic">Status updates automatically</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>Request Details</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Type</p>
                  <p className="font-semibold capitalize text-lg">{req.request_type}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Phone</p>
                  <p className="font-medium">{req.user_phone || "Not provided"}</p>
                </div>
              </div>
              {req.request_type === "correction" && (() => {
                let parsed: { corrections?: Record<string, string>; additional?: string } | null = null;
                try { parsed = req.request_details ? JSON.parse(req.request_details) : null; } catch { /* plain text */ }
                const corrections = parsed?.corrections;
                const additional = parsed?.additional;
                const LABELS: Record<string, string> = { full_name: "Full Name", email: "Email", phone: "Phone", address: "Address" };
                return (
                  <>
                    {corrections && Object.keys(corrections).length > 0 && (
                      <div className="pt-4 border-t border-border">
                        <p className="text-sm font-medium text-amber-700 mb-3 flex items-center gap-1.5">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          Requested Corrections
                        </p>
                        <div className="space-y-2">
                          {Object.entries(corrections).map(([key, val]) => (
                            <div key={key} className="flex items-start gap-3 bg-amber-50/60 border border-amber-200 rounded-sm px-3 py-2">
                              <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide w-24 shrink-0 pt-0.5">{LABELS[key] ?? key.replace(/_/g, " ")}</span>
                              <span className="text-sm font-medium text-foreground">→ {val}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="pt-4 border-t border-border">
                      <p className="text-sm font-medium text-muted-foreground mb-3">Additional Context</p>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed bg-muted/30 p-4 rounded-sm border border-border/50 min-h-[80px]">
                        {(corrections ? additional : req.request_details) || "No additional details provided by the citizen."}
                      </p>
                    </div>
                  </>
                );
              })()}
              {req.request_type !== "correction" && (
                <div className="pt-4 border-t border-border">
                  <p className="text-sm font-medium text-muted-foreground mb-3">Additional Context</p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed bg-muted/30 p-4 rounded-sm border border-border/50 min-h-[100px]">
                    {req.request_details || "No additional details provided by the citizen."}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-4">
              <div>
                <CardTitle>AI Assistant Analysis</CardTitle>
                <CardDescription>Generate an automated summary and action plan.</CardDescription>
              </div>
            </CardHeader>
            <AiSummary requestId={id} />
          </Card>

          {(req.request_type === "access" || req.request_type === "erasure" || req.request_type === "correction") && (
            <ProcessorPropagation
              requestId={id}
              requestType={req.request_type}
              userEmail={req.user_email}
              userName={req.user_name}
              requestedCorrections={(() => {
                if (req.request_type !== "correction" || !req.request_details) return undefined;
                try {
                  const parsed = JSON.parse(req.request_details);
                  return parsed.corrections ?? undefined;
                } catch { return undefined; }
              })()}
            />
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Timeline & SLA</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Created</p>
                <p className="text-sm font-medium">{formatDateTime(req.created_at)}</p>
              </div>
              <div className="py-4 border-y border-border">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Legal Deadline</p>
                <p className="text-sm font-semibold">{formatDateTime(req.deadline)}</p>
                {req.status !== "completed" && req.status !== "rejected" && daysRemaining !== null && (
                  <div className="mt-3">
                    <p className={`text-2xl font-bold ${getDaysRemainingTheme(daysRemaining)}`}>{daysRemaining}</p>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-1">Days Remaining</p>
                  </div>
                )}
              </div>
              {req.completed_at && (
                <div className="bg-green-50 p-3 rounded-sm border border-green-100">
                  <p className="text-xs font-medium text-green-800 uppercase tracking-wider mb-1">Resolved On</p>
                  <p className="text-sm font-semibold text-green-900">{formatDateTime(req.completed_at)}</p>
                </div>
              )}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Last System Update</p>
                <p className="text-sm text-muted-foreground">{formatDateTime(req.updated_at)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
