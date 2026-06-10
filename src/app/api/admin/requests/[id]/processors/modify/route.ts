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
    // corrections: { [processorId]: { [field]: newValue } }
    const corrections: Record<string, Record<string, unknown>> = body.corrections ?? {};

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
    const toModifySet = new Set(processorIds);

    // Log the modification FIRST to prevent out-of-sync state if DB is missing
    const rows = processorIds.map((processor) => ({
      request_id: id,
      processor,
      actioned_by: user.id,
      modified_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from("processor_modification_log").insert(rows);
    if (error) {
      console.error("Modification log insert error:", error);
      return NextResponse.json({ message: "Failed to log modification. Did you run the SQL migration?" }, { status: 500 });
    }

    // Actually apply corrections to the user's record in each selected processor
    for (const processor of processors) {
      if (toModifySet.has(processor.id)) {
        const match = findProcessorRecord(processor, userEmail, userPhone);

        if (match.found && match.key) {
          const fields = corrections[processor.id];
          if (fields && typeof fields === "object") {
            const oldRecord = processor.records[match.key] as Record<string, unknown>;
            processor.records[match.key] = {
              ...oldRecord,
              ...fields,
            };

            // If the email was changed and the key is that email, update the primary key to the new email
            if (fields.email && typeof fields.email === "string" && fields.email !== match.key && match.key === userEmail) {
              processor.records[fields.email] = processor.records[match.key];
              delete processor.records[match.key];
            }
          }
        }
      }
    }

    const filePath = join(process.cwd(), "data", "processors.json");
    writeFileSync(filePath, JSON.stringify(processors, null, 2), "utf-8");

    // Update status based on progress
    try {
      const applicableCount = processors.filter((p) => findProcessorRecord(p, userEmail, userPhone).found).length;
      const { data: logs } = await supabase
        .from("processor_modification_log")
        .select("processor")
        .eq("request_id", id);

      const uniqueActioned = new Set((logs || []).map((l) => l.processor)).size;
      const totalApplicable = applicableCount + uniqueActioned;

      if (totalApplicable > 0) {
        if (uniqueActioned >= totalApplicable) {
          await supabase
            .from("dsar_requests")
            .update({ status: "completed", completed_at: new Date().toISOString() })
            .eq("id", id);
          generateAndSaveStatusNote(supabase, id, reqData.user_email, "correction", "processing", "completed").catch(() => {});
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

    return NextResponse.json({ success: true, modified: processorIds });
  } catch (err) {
    console.error("Processor modify error:", err);
    return NextResponse.json({ message: "Failed to process modification", error: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined }, { status: 500 });
  }
}
