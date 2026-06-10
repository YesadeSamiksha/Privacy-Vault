import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return NextResponse.json({ message: "Missing token" }, { status: 400 });
    }

    const supabase = await createClient();

    // Find the request with this token
    const { data: request, error: fetchError } = await supabase
      .from("dsar_requests")
      .select("id, phone_verified, user_phone, email_token_expires_at")
      .eq("email_token", token)
      .eq("status", "pending")
      .single();

    if (fetchError || !request) {
      return NextResponse.json({ message: "Invalid or expired token" }, { status: 404 });
    }

    if (!request.email_token_expires_at || new Date(request.email_token_expires_at) < new Date()) {
      return NextResponse.json({ message: "Verification link has expired. Please submit a new request." }, { status: 400 });
    }

    // Determine new status
    // If phone is verified OR phone wasn't provided, we can move to submitted
    const isPhoneOkay = request.phone_verified || request.user_phone === null;
    const newStatus = isPhoneOkay ? "submitted" : "pending";

    const { error: updateError } = await supabase
      .from("dsar_requests")
      .update({
        email_verified: true,
        email_token: null,
        email_token_expires_at: null,
        status: newStatus,
      })
      .eq("id", request.id);

    if (updateError) throw updateError;

    return NextResponse.json({ 
      message: "Email verified successfully",
      status: newStatus
    }, { status: 200 });
  } catch (err) {
    console.error("Verify Email error:", err);
    return NextResponse.json({ message: "Failed to verify email" }, { status: 500 });
  }
}
