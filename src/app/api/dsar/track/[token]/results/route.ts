import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { readFileSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const supabase = await createClient();

    // 1. Fetch the request details
    const { data: requestData, error: requestError } = await supabase
      .from("dsar_requests")
      .select("id, request_type, status, user_email")
      .eq("token", token.toUpperCase())
      .single();

    if (requestError || !requestData) {
      return NextResponse.json({ message: "Request not found." }, { status: 404 });
    }

    // Only return data if the request is processing or completed
    if (requestData.status !== "completed" && requestData.status !== "processing") {
      return NextResponse.json({ 
        message: "Data is only available once the request is being processed.", 
        status: requestData.status 
      }, { status: 403 });
    }

    const { id: requestId, request_type, user_email } = requestData;

    // 2. Fetch the base processors list to know names/types
    const filePath = join(process.cwd(), "data", "processors.json");
    const raw = readFileSync(filePath, "utf-8");
    const processors: Array<{ id: string; name: string; type: string; records: Record<string, unknown> }> = JSON.parse(raw);

    const isPartial = requestData.status === "processing";

    // 3. Return different data based on the request type
    if (request_type === "access") {
      // Return actual JSON records matched by email
      const results = processors
        .filter(p => user_email in p.records)
        .map(p => ({
          processorId: p.id,
          processorName: p.name,
          type: p.type,
          data: p.records[user_email],
        }));
      return NextResponse.json({ type: "access", results, isPartial });
    }

    if (request_type === "erasure") {
      const { data: logs } = await supabase
        .from("processor_deletion_log")
        .select("processor, deleted_at")
        .eq("request_id", requestId);
      
      const logMap = new Map((logs || []).map(l => [l.processor, l.deleted_at]));
      
      const results = processors
        .filter(p => (user_email in p.records) || logMap.has(p.id))
        .map(p => {
          const deletedAt = logMap.get(p.id);
          return {
            processorId: p.id,
            processorName: p.name,
            type: p.type,
            data: p.records[user_email] || null,
            action: deletedAt ? "Deleted" : "In Progress",
            timestamp: deletedAt || null
          };
        });

      const actionedSystems = results.filter(r => r.timestamp !== null).length;
      return NextResponse.json({ type: "erasure", results, totalSystems: results.length, actionedSystems, isPartial });
    }

    if (request_type === "correction") {
      const { data: logs } = await supabase
        .from("processor_modification_log")
        .select("processor, modified_at")
        .eq("request_id", requestId);
      
      const logMap = new Map((logs || []).map(l => [l.processor, l.modified_at]));
      
      const results = processors
        .filter(p => (user_email in p.records) || logMap.has(p.id))
        .map(p => {
          const modifiedAt = logMap.get(p.id);
          return {
            processorId: p.id,
            processorName: p.name,
            type: p.type,
            data: p.records[user_email] || null,
            action: modifiedAt ? "Modified" : "In Progress",
            timestamp: modifiedAt || null
          };
        });

      const actionedSystems = results.filter(r => r.timestamp !== null).length;
      return NextResponse.json({ type: "modify", results, totalSystems: results.length, actionedSystems, isPartial });
    }

    // Fallback for other types
    return NextResponse.json({ message: "No third-party data available for this request type." }, { status: 400 });

  } catch (err) {
    console.error("Track results error:", err);
    return NextResponse.json({ message: "Failed to fetch results" }, { status: 500 });
  }
}
