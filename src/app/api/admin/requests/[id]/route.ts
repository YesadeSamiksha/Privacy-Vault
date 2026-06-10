import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getDaysRemaining } from "@/lib/utils";
import { z } from "zod";
import { generateAndSaveStatusNote } from "@/lib/status-note";

const updateSchema = z.object({
  status: z.enum(["submitted", "under_review", "processing", "completed", "rejected"]),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const { data, error } = await supabase.from("dsar_requests").select("*").eq("id", id).single();
    if (error || !data) return NextResponse.json({ message: "Not found" }, { status: 404 });

    // Auto-advance to under_review when admin opens the ticket
    if (data.status === "submitted") {
      await supabase.from("dsar_requests").update({ status: "under_review", updated_at: new Date().toISOString() }).eq("id", id);
      generateAndSaveStatusNote(supabase, id, data.user_name, data.request_type, "submitted", "under_review").catch(() => {});
      data.status = "under_review";
    }

    const daysRemaining = getDaysRemaining(data.deadline);
    return NextResponse.json({ ...data, daysRemaining, isUrgent: data.status !== "completed" && data.status !== "rejected" && daysRemaining !== null && daysRemaining < 7 });
  } catch (err) {
    console.error("Get request error:", err);
    return NextResponse.json({ message: "Failed to get request" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const body = updateSchema.safeParse(await req.json());
    if (!body.success) return NextResponse.json({ message: "Invalid status" }, { status: 400 });

    const { id } = await params;
    const { status } = body.data;
    const updateData: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (status === "completed") updateData.completed_at = new Date().toISOString();

    const { data, error } = await supabase.from("dsar_requests").update(updateData).eq("id", id).select("*").single();
    if (error || !data) return NextResponse.json({ message: "Not found" }, { status: 404 });

    const daysRemaining = getDaysRemaining(data.deadline);
    return NextResponse.json({ ...data, daysRemaining });
  } catch (err) {
    console.error("Update request error:", err);
    return NextResponse.json({ message: "Failed to update request" }, { status: 500 });
  }
}
