import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getDaysRemaining } from "@/lib/utils";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: all, error } = await supabase
      .from("dsar_requests")
      .select("status, deadline, created_at, completed_at, request_type");

    if (error) throw error;

    const rows = all ?? [];
    const total = rows.length;
    const completed = rows.filter((r) => r.status === "completed").length;
    const rejected = rows.filter((r) => r.status === "rejected").length;
    const overdue = rows.filter((r) => {
      if (r.status === "completed" || r.status === "rejected") return false;
      const d = getDaysRemaining(r.deadline);
      return d !== null && d < 0;
    }).length;

    const completedWithDates = rows.filter((r) => r.status === "completed" && r.completed_at && r.created_at);
    let averageResolutionDays: number | null = null;
    if (completedWithDates.length > 0) {
      const totalDays = completedWithDates.reduce((acc, r) => acc + Math.ceil((new Date(r.completed_at!).getTime() - new Date(r.created_at).getTime()) / 86400000), 0);
      averageResolutionDays = Math.round(totalDays / completedWithDates.length);
    }

    let complianceScore = 100;
    if (total > 0) {
      complianceScore = Math.max(0, Math.round(((completed + rejected) / total) * 70 + (1 - overdue / total) * 30));
    }

    return NextResponse.json({
      complianceScore, totalRequests: total, completedRequests: completed,
      overdueRequests: overdue, averageResolutionDays,
      byType: {
        access: rows.filter((r) => r.request_type === "access").length,
        correction: rows.filter((r) => r.request_type === "correction").length,
        erasure: rows.filter((r) => r.request_type === "erasure").length,
      },
      byStatus: {
        submitted: rows.filter((r) => r.status === "submitted").length,
        underReview: rows.filter((r) => r.status === "under_review").length,
        processing: rows.filter((r) => r.status === "processing").length,
        completed, rejected,
      },
      reportGeneratedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Compliance report error:", err);
    return NextResponse.json({ message: "Failed to generate report" }, { status: 500 });
  }
}
