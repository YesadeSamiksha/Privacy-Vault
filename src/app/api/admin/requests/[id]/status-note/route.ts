import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

const STATUS_LABELS: Record<string, string> = {
  submitted: "Submitted",
  under_review: "Under Review",
  processing: "Processing",
  completed: "Completed",
  rejected: "Rejected",
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const { newStatus, previousStatus } = await req.json();

    const { data, error } = await supabase.from("dsar_requests").select("*").eq("id", id).single();
    if (error || !data) return NextResponse.json({ message: "Not found" }, { status: 404 });

    const prevLabel = STATUS_LABELS[previousStatus] ?? previousStatus;
    const newLabel = STATUS_LABELS[newStatus] ?? newStatus;

    let adminNote = "";

    try {
      const geminiKey = process.env.GEMINI_API_KEY || "";
      const prompt = `You are a Data Protection Officer assistant for a privacy compliance platform under India's DPDP Act 2023.

A DSAR (Data Subject Access Request) status has been updated by an admin.

Request Details:
- Citizen Name: ${data.user_name}
- Request Type: ${data.request_type.toUpperCase()}
- Previous Status: ${prevLabel}
- New Status: ${newLabel}

Write a short, clear, friendly 2-3 sentence update message addressed to the citizen explaining what this status change means for their request and what they can expect next. Use plain language, no jargon. Do not include any headings or labels, just the message text.`;

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 200 },
          }),
        }
      );

      if (res.ok) {
        const aiData = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
        adminNote = aiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
      }
    } catch {
      // fallback below
    }

    if (!adminNote) {
      const fallbacks: Record<string, string> = {
        under_review: `Your ${data.request_type} request is now being reviewed by our Data Protection Officer. We will assess your request and update you shortly.`,
        processing: `Your ${data.request_type} request has been approved and is now being actively processed. Our team is working to fulfill it within the legal deadline.`,
        completed: `Your ${data.request_type} request has been fully completed. You can view the results on this page. Thank you for using PrivacyVault.`,
        rejected: `After review, your ${data.request_type} request could not be fulfilled at this time. Please contact our support team if you have questions.`,
        submitted: `Your request has been received and is queued for admin review. You will be notified as it progresses.`,
      };
      adminNote = fallbacks[newStatus] ?? `Your request status has been updated to ${newLabel}.`;
    }

    await supabase.from("dsar_requests").update({ admin_note: adminNote }).eq("id", id);

    return NextResponse.json({ adminNote });
  } catch (err) {
    console.error("Status note error:", err);
    return NextResponse.json({ message: "Failed to generate note" }, { status: 500 });
  }
}
