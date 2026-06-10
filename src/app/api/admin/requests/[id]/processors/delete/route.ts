import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { writeFileSync } from "fs";
import { join } from "path";
import { loadProcessors, findProcessorRecord } from "@/lib/processors";
import { generateAndSaveStatusNote } from "@/lib/status-note";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const processorIds: string[] = body.processorIds ?? [];

    if (!Array.isArray(processorIds) || processorIds.length === 0) {
      return NextResponse.json({ message: "No processor IDs provided" }, { status: 400 });
    }

    // Get user email & phone for this request
    const { data: reqData } = await supabase
      .from("dsar_requests")
      .select("user_email, user_phone")
      .eq("id", id)
      .single();

    if (!reqData?.user_email) {
      return NextResponse.json({ message: "Request not found" }, { status: 404 });
    }

    const userEmail = reqData.user_email as string;
    const userPhone = reqData.user_phone as string | null | undefined;
    const processors = loadProcessors();
    const toDeleteSet = new Set(processorIds);

    // Log the deletion FIRST to prevent out-of-sync state if DB is missing
    const rows = processorIds.map((processor) => ({
      request_id: id,
      processor,
      actioned_by: user.id,
      deleted_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from("processor_deletion_log").insert(rows);
    if (error) {
      console.error("Deletion log insert error:", error);
      return NextResponse.json({ message: "Failed to log deletion. Did you run the SQL migration?" }, { status: 500 });
    }

    // Actually delete the user's record from each selected processor
    for (const processor of processors) {
      if (toDeleteSet.has(processor.id)) {
        const match = findProcessorRecord(processor, userEmail, userPhone);
        if (match.found && match.key) {
          delete processor.records[match.key];
        }
      }
    }

    const filePath = join(process.cwd(), "data", "processors.json");
    writeFileSync(filePath, JSON.stringify(processors, null, 2), "utf-8");

    // Update status based on progress
    try {
      const remainingCount = processors.filter((p) => findProcessorRecord(p, userEmail, userPhone).found).length;
      const { data: logs } = await supabase
        .from("processor_deletion_log")
        .select("processor")
        .eq("request_id", id);

      const uniqueActioned = new Set((logs || []).map((l) => l.processor)).size;
      const totalApplicable = remainingCount + uniqueActioned;

      if (totalApplicable > 0) {
        if (uniqueActioned >= totalApplicable) {
          await supabase
            .from("dsar_requests")
            .update({ status: "completed", completed_at: new Date().toISOString() })
            .eq("id", id);
          generateAndSaveStatusNote(supabase, id, reqData.user_email, "erasure", "processing", "completed").catch(() => {});
        } else {
          await supabase
            .from("dsar_requests")
            .update({ status: "processing" })
            .eq("id", id);
        }
      }
    } catch (autoErr) {
      console.error("Auto-complete error:", autoErr);
    }

    return NextResponse.json({ success: true, deleted: processorIds });
  } catch (err) {
    console.error("Processor delete error:", err);
    return NextResponse.json({ message: "Failed to process deletion" }, { status: 500 });
  }
}
