import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { z } from "zod";
import twilio from "twilio";
import { formatPhoneToE164 } from "@/lib/utils";

const schema = z.object({
  requestId: z.string().uuid(),
  phone: z.string().min(10),
});

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export async function POST(req: NextRequest) {
  try {
    const body = schema.safeParse(await req.json());
    if (!body.success) {
      return NextResponse.json({ message: "Invalid request data" }, { status: 400 });
    }

    const { requestId, phone } = body.data;
    const formattedPhone = formatPhoneToE164(phone);
    if (!formattedPhone) {
      return NextResponse.json({ message: "Invalid phone number format" }, { status: 400 });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const supabase = await createClient();

    const { data: existing, error: fetchError } = await supabase
      .from("dsar_requests")
      .select("id, last_otp_sent_at")
      .eq("id", requestId)
      .eq("status", "pending")
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ message: "Request not found" }, { status: 404 });
    }

    // Rate limit: 60 seconds cooldown
    const lastSent = existing.last_otp_sent_at ? new Date(existing.last_otp_sent_at.endsWith("Z") ? existing.last_otp_sent_at : existing.last_otp_sent_at + "Z") : null;
    if (lastSent && Date.now() - lastSent.getTime() < 60 * 1000) {
      const waitSecs = Math.ceil((60 * 1000 - (Date.now() - lastSent.getTime())) / 1000);
      return NextResponse.json({ message: `Please wait ${waitSecs} seconds before requesting another OTP.` }, { status: 429 });
    }

    const { error } = await supabase
      .from("dsar_requests")
      .update({ 
        phone_otp: otp, 
        otp_expires_at: otpExpiresAt, 
        otp_attempts: 0,
        last_otp_sent_at: new Date().toISOString()
      })
      .eq("id", requestId);

    if (error) throw error;

    // Send SMS using Twilio (strictly, no fallback)
    await client.messages.create({
      body: `Your PrivacyVault OTP is: ${otp}. It will expire in 10 minutes.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: formattedPhone,
    });

    return NextResponse.json({ message: "OTP sent successfully" }, { status: 200 });
  } catch (err: any) {
    console.error("Send OTP error:", err);
    return NextResponse.json({ message: err.message || "Failed to send OTP" }, { status: 500 });
  }
}
