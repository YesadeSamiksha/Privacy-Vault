import { SupabaseClient } from "@supabase/supabase-js";

const STATUS_LABELS: Record<string, string> = {
  submitted: "Submitted",
  under_review: "Under Review",
  processing: "Processing",
  completed: "Completed",
  rejected: "Rejected",
};

const FALLBACKS: Record<string, string> = {
  under_review: "Your request is now being reviewed by our Data Protection Officer. We will assess it and update you shortly.",
  processing: "Your request has been approved and is now being actively processed. Our team is working to fulfill it within the legal deadline.",
  completed: "Your request has been fully completed. You can view the results on the tracking page. Thank you for using PrivacyVault.",
  rejected: "After review, your request could not be fulfilled at this time. Please contact our support team if you have questions.",
};

export async function generateAndSaveStatusNote(
  supabase: SupabaseClient,
  requestId: string,
  userName: string,
  requestType: string,
  previousStatus: string,
  newStatus: string
) {
  const prevLabel = STATUS_LABELS[previousStatus] ?? previousStatus;
  const newLabel = STATUS_LABELS[newStatus] ?? newStatus;
  let adminNote = "";

  try {
    const geminiKey = process.env.GEMINI_API_KEY || "";
    const prompt = `You are a Data Protection Officer assistant for a privacy compliance platform under India's DPDP Act 2023.\n\nA DSAR status has been automatically updated.\n\n- Citizen: ${userName}\n- Request Type: ${requestType.toUpperCase()}\n- Previous Status: ${prevLabel}\n- New Status: ${newLabel}\n\nWrite a short, clear, friendly 2-3 sentence update message to the citizen explaining what this status change means and what to expect next. Plain language only, no headings or labels.`;

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
    // fall through to fallback
  }

  if (!adminNote) {
    adminNote = FALLBACKS[newStatus] ?? `Your request status has been updated to ${newLabel}.`;
  }

  await supabase.from("dsar_requests").update({ admin_note: adminNote }).eq("id", requestId);
}
