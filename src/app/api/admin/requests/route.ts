import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getDaysRemaining } from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const status = req.nextUrl.searchParams.get("status");
    const validStatuses = ["submitted", "under_review", "processing", "completed", "rejected"];

    let query = supabase.from("dsar_requests").select("*").neq("status", "pending").order("created_at", { ascending: false });
    if (status && validStatuses.includes(status)) query = query.eq("status", status);

    const [{ data: requests }, { data: all }] = await Promise.all([
      query,
      supabase.from("dsar_requests").select("status, deadline").neq("status", "pending"),
    ]);

    const allRows = all ?? [];
    const stats = {
      submitted: allRows.filter((r) => r.status === "submitted").length,
      underReview: allRows.filter((r) => r.status === "under_review").length,
      processing: allRows.filter((r) => r.status === "processing").length,
      completed: allRows.filter((r) => r.status === "completed").length,
      rejected: allRows.filter((r) => r.status === "rejected").length,
      urgent: 0,
    };

    const mappedRequests = (requests ?? []).map((r) => {
      const daysRemaining = getDaysRemaining(r.deadline);
      const isUrgent = r.status !== "completed" && r.status !== "rejected" && daysRemaining !== null && daysRemaining < 7;
      if (isUrgent) stats.urgent++;
      return { id: r.id, token: r.token, userName: r.user_name, userEmail: r.user_email, requestType: r.request_type, status: r.status, deadline: r.deadline, createdAt: r.created_at, daysRemaining, isUrgent };
    });

    return NextResponse.json({ requests: mappedRequests, total: mappedRequests.length, stats });
  } catch (err) {
    console.error("List requests error:", err);
    return NextResponse.json({ message: "Failed to list requests" }, { status: 500 });
  }
}
