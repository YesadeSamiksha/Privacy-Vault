import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { z } from "zod";

const schema = z.object({
  requestId: z.string().uuid(),
  phone: z.string().min(10),
});

export async function POST(req: NextRequest) {
  try {
    const body = schema.safeParse(await req.json());
    if (!body.success) {
      return NextResponse.json({ message: "Invalid request data" }, { status: 400 });
    }

    const { requestId, phone } = body.data;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const supabase = await createClient();

    const { data: existing, error: fetchError } = await supabase
      .from("dsar_requests")
      .select("id")
      .eq("id", requestId)
      .eq("status", "pending")
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ message: "Request not found" }, { status: 404 });
    }

    const { error } = await supabase
      .from("dsar_requests")
      .update({ phone_otp: otp, otp_expires_at: otpExpiresAt, otp_attempts: 0 })
      .eq("id", requestId);

    if (error) throw error;

    console.log("----------------------------------------");
    console.log(`[SIMULATED SMS (Twilio) TO ${phone}]`);
    console.log(`Your PrivacyVault OTP is: ${otp}`);
    console.log("----------------------------------------");

    return NextResponse.json({ message: "OTP sent successfully" }, { status: 200 });
  } catch (err) {
    console.error("Send OTP error:", err);
    return NextResponse.json({ message: "Failed to send OTP" }, { status: 500 });
  }
}
