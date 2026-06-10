import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { z } from "zod";
import { Resend } from "resend";
import { formatPhoneToE164 } from "@/lib/utils";

const schema = z.object({
  userName: z.string().min(2),
  userEmail: z.string().email(),
  userPhone: z.string().optional(),
  requestType: z.enum(["access", "correction", "erasure"]),
  requestDetails: z.string().optional(),
});

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const body = schema.safeParse(await req.json());
    if (!body.success) {
      return NextResponse.json({ message: "Invalid request data" }, { status: 400 });
    }

    const { userName, userEmail, userPhone, requestType, requestDetails } = body.data;
    const formattedPhone = formatPhoneToE164(userPhone);

    const supabase = await createClient();
    const emailToken = crypto.randomUUID();
    const emailTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("dsar_requests")
      .insert({
        user_name: userName,
        user_email: userEmail,
        user_phone: formattedPhone ?? null,
        request_type: requestType,
        request_details: requestDetails ?? null,
        email_token: emailToken,
        email_token_expires_at: emailTokenExpiresAt,
        status: "pending",
      })
      .select("id, token, deadline")
      .single();

    if (error) throw error;

    // Send real email via Resend
    await resend.emails.send({
      from: "PrivacyVault <onboarding@resend.dev>",
      to: userEmail,
      subject: "Action Required: Verify your PrivacyVault Request",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #0f172a;">Verify Your Privacy Request</h2>
          <p style="color: #475569; line-height: 1.6;">Hello ${userName},</p>
          <p style="color: #475569; line-height: 1.6;">We received a Data Subject Access Request (DSAR) under the DPDP Act 2023 associated with this email address.</p>
          <p style="color: #475569; line-height: 1.6; margin-bottom: 30px;">To verify your identity and submit the request, please click the button below:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="http://localhost:3000/verify-email?token=${emailToken}" 
               style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
               Verify Email Address
            </a>
          </div>
          <p style="color: #94a3b8; font-size: 12px; margin-top: 30px;">If you did not make this request, you can safely ignore this email.</p>
        </div>
      `,
    });

    return NextResponse.json({ token: data.token, id: data.id, deadline: data.deadline }, { status: 201 });
  } catch (err: any) {
    console.error("Submit DSAR error:", err);
    return NextResponse.json({ message: "Failed to submit request", error: err }, { status: 500 });
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
