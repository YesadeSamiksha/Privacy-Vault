import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getDaysRemaining } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("dsar_requests")
      .select("*")
      .eq("token", token.toUpperCase())
      .single();

    if (error || !data) {
      return NextResponse.json({ message: "Request not found. Check your token." }, { status: 404 });
    }

    return NextResponse.json({
      token: data.token,
      requestType: data.request_type,
      status: data.status,
      userName: data.user_name,
      createdAt: data.created_at,
      deadline: data.deadline,
      updatedAt: data.updated_at,
      completedAt: data.completed_at ?? null,
      daysRemaining: getDaysRemaining(data.deadline),
      emailVerified: data.email_verified ?? false,
      phoneVerified: data.phone_verified ?? false,
      userPhone: data.user_phone ?? null,
      adminNote: data.admin_note ?? null,
    });
  } catch (err) {
    console.error("Track DSAR error:", err);
    return NextResponse.json({ message: "Failed to track request" }, { status: 500 });
  }
}
