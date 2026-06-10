import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { readFileSync } from "fs";
import { join } from "path";
import { generateAndSaveStatusNote } from "@/lib/status-note";

export async function GET(
  _req: NextRequest,
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
    const { data: req, error } = await supabase
      .from("dsar_requests")
      .select("request_type, user_email, status")
      .eq("id", id)
      .single();

    if (error || !req)
      return NextResponse.json({ message: "Request not found" }, { status: 404 });

    const filePath = join(process.cwd(), "data", "processors.json");
    const raw = readFileSync(filePath, "utf-8");
    const processors: Array<{
      id: string;
      name: string;
      type: string;
      records: Record<string, unknown>;
    }> = JSON.parse(raw);

    const citizenEmail = req.user_email as string;
    const requestType = req.request_type as string;

    const actionedSet = new Set<string>();

    if (requestType === "erasure") {
      const { data: logs } = await supabase
        .from("processor_deletion_log")
        .select("processor")
        .eq("request_id", id);
      (logs || []).forEach(l => actionedSet.add(l.processor));
    } else if (requestType === "correction") {
      const { data: logs } = await supabase
        .from("processor_modification_log")
        .select("processor")
        .eq("request_id", id);
      (logs || []).forEach(l => actionedSet.add(l.processor));
    }

    const results = processors.map((processor) => {
      let found = citizenEmail in processor.records;
      let recordKey = citizenEmail;

      if (!found) {
        for (const [key, value] of Object.entries(processor.records)) {
          if (value && typeof value === 'object' && (value as any).email === citizenEmail) {
            found = true;
            recordKey = key;
            break;
          }
        }
      }

      const isActioned = actionedSet.has(processor.id);
      
      return {
        processorId: processor.id,
        processorName: processor.name,
        type: processor.type,
        found,
        deleted: (requestType === "erasure" && isActioned),
        modified: (requestType === "modify" && isActioned),
        data: found ? processor.records[recordKey] : null,
      };
    });

    // Auto-advance status based on request type and current status
    if (req.status === "under_review" || req.status === "submitted") {
      if (requestType === "access") {
        // Access = just viewing data, fetching IS the action → complete immediately
        await supabase
          .from("dsar_requests")
          .update({ status: "completed", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("id", id);
        generateAndSaveStatusNote(supabase, id, req.user_email, requestType, req.status, "completed").catch(() => {});
      } else {
        // erasure / correction → move to processing, admin still needs to action processors
        await supabase
          .from("dsar_requests")
          .update({ status: "processing", updated_at: new Date().toISOString() })
          .eq("id", id);
        generateAndSaveStatusNote(supabase, id, req.user_email, requestType, req.status, "processing").catch(() => {});
      }
    }

    return NextResponse.json({ processors: results });
  } catch (err) {
    console.error("Processors fetch error:", err);
    return NextResponse.json(
      { message: "Failed to fetch processors" },
      { status: 500 }
    );
  }
}
