import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { z } from "zod";

const schema = z.object({
  requestId: z.string().uuid(),
  otp: z.string().length(6),
});

export async function POST(req: NextRequest) {
  try {
    const body = schema.safeParse(await req.json());
    if (!body.success) {
      return NextResponse.json({ message: "Invalid request data" }, { status: 400 });
    }

    const { requestId, otp } = body.data;

    const supabase = await createClient();

    const { data: request, error: fetchError } = await supabase
      .from("dsar_requests")
      .select("phone_otp, otp_expires_at, otp_attempts, email_verified")
      .eq("id", requestId)
      .eq("status", "pending")
      .single();

    if (fetchError || !request) {
      return NextResponse.json({ message: "Request not found or already processed" }, { status: 404 });
    }

    const attempts = request.otp_attempts ?? 0;
    if (attempts >= 5) {
      return NextResponse.json({ message: "Too many attempts. Please request a new OTP." }, { status: 429 });
    }

    if (!request.otp_expires_at || new Date(request.otp_expires_at) < new Date()) {
      return NextResponse.json({ message: "OTP has expired. Please request a new one." }, { status: 400 });
    }

    if (request.phone_otp !== otp) {
      await supabase
        .from("dsar_requests")
        .update({ otp_attempts: attempts + 1 })
        .eq("id", requestId);
      return NextResponse.json({ message: `Invalid OTP. ${4 - attempts} attempts remaining.` }, { status: 400 });
    }

    const newStatus = request.email_verified ? "submitted" : "pending";

    const { error: updateError } = await supabase
      .from("dsar_requests")
      .update({
        phone_verified: true,
        phone_otp: null,
        otp_expires_at: null,
        otp_attempts: 0,
        status: newStatus,
      })
      .eq("id", requestId);

    if (updateError) throw updateError;

    return NextResponse.json({ message: "Phone verified successfully", status: newStatus }, { status: 200 });
  } catch (err) {
    console.error("Verify OTP error:", err);
    return NextResponse.json({ message: "Failed to verify OTP" }, { status: 500 });
  }
}
