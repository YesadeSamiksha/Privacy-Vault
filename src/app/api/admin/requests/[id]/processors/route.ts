import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { loadProcessors, findProcessorRecord } from "@/lib/processors";
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
      .select("request_type, user_email, user_phone, status")
      .eq("id", id)
      .single();

    if (error || !req)
      return NextResponse.json({ message: "Request not found" }, { status: 404 });

    const processors = loadProcessors();

    const citizenEmail = req.user_email as string;
    const citizenPhone = req.user_phone as string | null | undefined;
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
      const match = findProcessorRecord(processor, citizenEmail, citizenPhone);
      const isActioned = actionedSet.has(processor.id);
      
      return {
        processorId: processor.id,
        processorName: processor.name,
        type: processor.type,
        found: match.found,
        deleted: (requestType === "erasure" && isActioned),
        modified: (requestType === "correction" && isActioned),
        data: match.data,
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
