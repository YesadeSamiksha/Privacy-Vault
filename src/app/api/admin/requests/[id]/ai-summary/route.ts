import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getDaysRemaining } from "@/lib/utils";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const { data, error } = await supabase.from("dsar_requests").select("*").eq("id", id).single();
    if (error || !data) return NextResponse.json({ message: "Not found" }, { status: 404 });

    const daysRemaining = getDaysRemaining(data.deadline);
    const urgencyLevel = daysRemaining === null ? "medium" : daysRemaining < 7 ? "high" : daysRemaining < 15 ? "medium" : "low";

    const typeDescriptions: Record<string, string> = {
      access: "requesting a complete copy of all personal data held by the organization",
      correction: "requesting correction of inaccurate personal data",
      erasure: "requesting permanent deletion of all personal data (Right to be Forgotten)",
    };

    const typeDesc = typeDescriptions[data.request_type] || data.request_type;
    const detailsText = data.request_details ? `\n\nAdditional details: "${data.request_details}"` : "\n\nNo additional details provided.";

    let summary = "";
    let recommendedAction = "";

    try {
      const geminiKey = process.env.GEMINI_API_KEY || "";
      const prompt = `You are a Data Protection Officer assistant helping to process DPDP Act 2023 compliance requests in India.\n\nDSAR Analysis:\n- Citizen: ${data.user_name}\n- Type: ${data.request_type.toUpperCase()} — ${typeDesc}\n- Status: ${data.status}\n- Days Remaining: ${daysRemaining ?? "Unknown"}${detailsText}\n\nProvide:\nSUMMARY: [2-3 sentence summary]\nRECOMMENDED ACTION: [specific action]`;

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 500 },
          }),
        }
      );

      if (res.ok) {
        const aiData = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
        const text = aiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        summary = text.match(/SUMMARY:\s*([\s\S]+?)(?=RECOMMENDED ACTION:|$)/)?.[1]?.trim() ?? text.trim();
        recommendedAction = text.match(/RECOMMENDED ACTION:\s*([\s\S]+?)$/)?.[1]?.trim() ?? "Review and process within the legal deadline.";
      } else {
        throw new Error("AI API non-OK");
      }
    } catch {
      const fallbacks: Record<string, { summary: string; action: string }> = {
        access: {
          summary: `${data.user_name} has submitted a Right of Access request under India's DPDP Act 2023, ${typeDesc}. ${daysRemaining !== null ? `${daysRemaining} days remaining to comply.` : ""}`,
          action: "Compile all personal data held for this citizen and send a structured summary to their registered email.",
        },
        correction: {
          summary: `${data.user_name} has submitted a Right to Correction request under India's DPDP Act 2023, ${typeDesc}. ${daysRemaining !== null ? `${daysRemaining} days remaining to comply.` : ""}`,
          action: "Review the citizen's records, update inaccuracies, and confirm the correction in writing.",
        },
        erasure: {
          summary: `${data.user_name} has submitted a Right to Erasure request under India's DPDP Act 2023, ${typeDesc}. ${daysRemaining !== null ? `${daysRemaining} days remaining to comply.` : ""}`,
          action: "Initiate data deletion across all systems and confirm erasure to the citizen within the legal deadline.",
        },
      };
      const fallback = fallbacks[data.request_type] ?? {
        summary: `${data.user_name} has submitted a ${data.request_type} DSAR under India's DPDP Act 2023.`,
        action: "Review and respond within the legal 30-day deadline.",
      };
      summary = fallback.summary;
      recommendedAction = fallback.action;
    }

    return NextResponse.json({ summary, recommendedAction, urgencyLevel });
  } catch (err) {
    console.error("AI summary error:", err);
    return NextResponse.json({ message: "Failed to generate AI summary" }, { status: 500 });
  }
}
