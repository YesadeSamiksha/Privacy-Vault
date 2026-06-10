import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { z } from "zod";

const schema = z.object({
  userName: z.string().min(2),
  userEmail: z.string().email(),
  userPhone: z.string().optional(),
  requestType: z.enum(["access", "correction", "erasure"]),
  requestDetails: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = schema.safeParse(await req.json());
    if (!body.success) {
      return NextResponse.json({ message: "Invalid request data" }, { status: 400 });
    }

    const { userName, userEmail, userPhone, requestType, requestDetails } = body.data;
    const supabase = await createClient();
    const emailToken = crypto.randomUUID();
    const emailTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("dsar_requests")
      .insert({
        user_name: userName,
        user_email: userEmail,
        user_phone: userPhone ?? null,
        request_type: requestType,
        request_details: requestDetails ?? null,
        email_token: emailToken,
        email_token_expires_at: emailTokenExpiresAt,
        status: "pending",
      })
      .select("id, token, deadline")
      .single();

    if (error) throw error;

    // Simulate sending an email in development
    console.log("----------------------------------------");
    console.log(`[SIMULATED EMAIL TO ${userEmail}]`);
    console.log(`Verify your request by clicking this link:`);
    console.log(`http://localhost:3000/verify-email?token=${emailToken}`);
    console.log("----------------------------------------");

    return NextResponse.json({ token: data.token, id: data.id, deadline: data.deadline }, { status: 201 });
  } catch (err) {
    console.error("Submit DSAR error:", String(err).replace(/[\r\n]/g, " "));
    return NextResponse.json({ message: "Failed to submit request" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, requestType, requestDetails } = await req.json();
    if (!id || !requestType) {
      return NextResponse.json({ message: "Missing id or requestType" }, { status: 400 });
    }
    const supabase = await createClient();
    const { error } = await supabase
      .from("dsar_requests")
      .update({ request_type: requestType, request_details: requestDetails ?? null })
      .eq("id", id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Patch DSAR error:", String(err).replace(/[\r\n]/g, " "));
    return NextResponse.json({ message: "Failed to update request" }, { status: 500 });
  }
}
