import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getDaysRemaining } from "@/lib/utils";
import { loadProcessors, findProcessorRecord } from "@/lib/processors";

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

    // 1. Find all matching third-party processors and records
    const processors = loadProcessors();
    const matchedList: Array<{ id: string; name: string; type: string; data: any }> = [];
    const categoriesSet = new Set<string>();

    processors.forEach(p => {
      const match = findProcessorRecord(p, data.user_email, data.user_phone);
      if (match.found) {
        matchedList.push({
          id: p.id,
          name: p.name,
          type: p.type,
          data: match.data,
        });

        // Infer categories based on processor type or fields
        if (p.type.toLowerCase().includes("payment") || p.type.toLowerCase().includes("finance")) {
          categoriesSet.add("Financial");
        } else if (p.type.toLowerCase().includes("hr") || p.type.toLowerCase().includes("people")) {
          categoriesSet.add("Employment");
        } else if (p.type.toLowerCase().includes("crm") || p.type.toLowerCase().includes("sale")) {
          categoriesSet.add("Customer Relationship");
        } else if (p.type.toLowerCase().includes("marketing")) {
          categoriesSet.add("Marketing");
        } else if (p.type.toLowerCase().includes("delivery")) {
          categoriesSet.add("Location");
        } else if (p.type.toLowerCase().includes("e-commerce")) {
          categoriesSet.add("Transaction History");
        } else {
          categoriesSet.add("Other");
        }

        // Check for KYC/Identity fields inside data
        if (match.data) {
          const keys = Object.keys(match.data).map(k => k.toLowerCase());
          if (keys.some(k => k.includes("kyc") || k.includes("aadhaar") || k.includes("pan") || k.includes("passport"))) {
            categoriesSet.add("Identity (KYC)");
          }
        }
      }
    });

    const dataCategories = Array.from(categoriesSet);

    // 2. Programmatically calculate base exposure score
    let baseExposureScore = 0;
    if (matchedList.length > 0) {
      if (categoriesSet.has("Identity (KYC)")) baseExposureScore += 35;
      if (categoriesSet.has("Financial")) baseExposureScore += 30;
      if (categoriesSet.has("Employment")) baseExposureScore += 15;
      if (categoriesSet.has("Location")) baseExposureScore += 10;
      if (categoriesSet.has("Customer Relationship") || categoriesSet.has("Transaction History")) baseExposureScore += 5;
      
      // Add a scale for the number of matched processors
      baseExposureScore += matchedList.length * 4;
      baseExposureScore = Math.min(100, Math.max(10, baseExposureScore));
    }

    // 3. Contact Gemini 2.5 Flash Lite for structured compliance report
    let aiReport: {
      exposure_score: number;
      risk_score: string;
      data_categories: string[];
      compliance_insights: string;
      dpdp_recommendations: string;
      ai_summary: string;
    };

    try {
      const geminiKey = process.env.GEMINI_API_KEY || "";
      if (!geminiKey) throw new Error("Gemini key not configured");

      const prompt = `You are a Data Protection Officer assistant helping to process DPDP Act 2023 compliance requests in India.
We have found matched personal data records for the following citizen request:
- Citizen Name: ${data.user_name}
- Request Type: ${data.request_type.toUpperCase()}
- Status: ${data.status}
- Days Remaining to comply: ${daysRemaining ?? "Unknown"}
- Additional Details: "${data.request_details || "None"}"

We searched our synthetic third-party data processors and found matches in these systems:
${JSON.stringify(matchedList, null, 2)}

Programmatic Exposure Score calculated is: ${baseExposureScore} (out of 100)

Please perform a compliance risk assessment. You must return a valid JSON object matching the following structure:
{
  "exposure_score": number, // Calculate or refine the exposure score (0-100) based on sensitivity (Financial, KYC, Aadhaar data is high exposure).
  "risk_score": "Low" | "Medium" | "High", // Risk level based on the type of data and number of processors.
  "data_categories": string[], // List of data categories present, e.g., ["Financial", "Identity", "Location", "Employment"]
  "compliance_insights": string, // Bulleted points explaining legal obligations. Keep it extremely concise (max 2 short bullets, max 30 words total).
  "dpdp_recommendations": string, // Actionable steps for the DPO. Keep it extremely concise (max 2 short steps, max 30 words total).
  "ai_summary": string // A concise, customer-friendly 1-2 sentence summary explaining what data was found (max 30 words).
}

CRITICAL: The entire JSON response MUST be very short and fit within 400 tokens to prevent truncation. Keep all text fields extremely brief and minimal. Do not include any markdown formatting (like \`\`\`json) in your response. Return ONLY the raw JSON string.`;

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: "application/json",
              maxOutputTokens: 512,
              temperature: 0.3
            },
          }),
        }
      );

      if (res.ok) {
        const aiData = await res.json();
        const text = aiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        
        let cleanedText = text.trim();
        if (cleanedText.startsWith("```")) {
          cleanedText = cleanedText.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
        }
        
        const parsed = JSON.parse(cleanedText);
        aiReport = {
          exposure_score: parsed.exposure_score ?? baseExposureScore,
          risk_score: parsed.risk_score ?? (baseExposureScore >= 70 ? "High" : baseExposureScore >= 35 ? "Medium" : "Low"),
          data_categories: parsed.data_categories ?? dataCategories,
          compliance_insights: parsed.compliance_insights ?? "",
          dpdp_recommendations: parsed.dpdp_recommendations ?? "",
          ai_summary: parsed.ai_summary ?? "",
        };
      } else {
        const errBody = await res.text().catch(() => "");
        console.error("Gemini API error body:", errBody);
        throw new Error("AI API non-OK response status " + res.status);
      }
    } catch (err) {
      console.warn("Using fallback AI summary due to error:", err);
      // Construct fallback values
      const riskScore = baseExposureScore >= 70 ? "High" : baseExposureScore >= 35 ? "Medium" : "Low";
      const catStr = dataCategories.join(", ") || "Contact details";
      
      const fallbacks: Record<string, { insights: string; recommendations: string; summary: string }> = {
        access: {
          insights: `• Under Section 6 of the DPDP Act 2023, the citizen is entitled to know what personal data is processed.\n• The data fiduciary must share processing descriptions and matched third-party processors.\n• Legal response window: 30 days.`,
          recommendations: `1. Retrieve personal data records from the ${matchedList.length} matched processors.\n2. Confirm identities of downstream processors: ${matchedList.map(m => m.name).join(", ")}.\n3. Export results to a secure PDF and transmit to the citizen.`,
          summary: `A Right of Access request was received. Personal data has been located in ${matchedList.length} downstream systems. Exposure level is ${riskScore.toLowerCase()} (Score: ${baseExposureScore}/100) across categories: ${catStr}.`,
        },
        erasure: {
          insights: `• Section 12 of the DPDP Act requires the erasure of personal data once purpose is fulfilled or consent is withdrawn.\n• The fiduciary must propagate the erasure command to all downstream processors.\n• Retaining logs of deletion is mandatory for compliance verification.`,
          recommendations: `1. Notify all matched processors (${matchedList.map(m => m.name).join(", ")}) to execute permanent deletion.\n2. Monitor and verify the completion status of the deletion tasks.\n3. Update the request status and notify the citizen once completed.`,
          summary: `A Right to Erasure request was received. Deletion process is in progress across ${matchedList.length} systems. Exposure level was ${riskScore.toLowerCase()} (Score: ${baseExposureScore}/100).`,
        },
        correction: {
          insights: `• Section 12 outlines the right to correct, complete, or update personal data.\n• Correction requests must be verified for authenticity and propagated to all third-party processors.\n• Updates must be logged for auditability.`,
          recommendations: `1. Review the corrected details requested by the citizen.\n2. Push the modifications to the matched processors: ${matchedList.map(m => m.name).join(", ")}.\n3. Verify that the changes have been applied successfully and log the action.`,
          summary: `A Right to Correction request was received. Personal data update is in progress for ${matchedList.length} systems. Exposure level is ${riskScore.toLowerCase()} (Score: ${baseExposureScore}/100).`,
        },
      };

      const selected = fallbacks[data.request_type] || {
        insights: `• Legal request processing under the DPDP Act 2023.\n• Matched ${matchedList.length} third-party processors.`,
        recommendations: `1. Review citizen request and matching records.\n2. Respond within the 30-day compliance timeline.`,
        summary: `DSAR request received. Matched ${matchedList.length} systems. Exposure score is ${baseExposureScore}/100.`,
      };

      aiReport = {
        exposure_score: baseExposureScore,
        risk_score: riskScore,
        data_categories: dataCategories,
        compliance_insights: selected.insights,
        dpdp_recommendations: selected.recommendations,
        ai_summary: selected.summary,
      };
    }

    // 4. Update the database record with the generated values
    const processorSummary = matchedList.map(m => ({ id: m.id, name: m.name, type: m.type }));
    const { error: updateError } = await supabase
      .from("dsar_requests")
      .update({
        exposure_score: aiReport.exposure_score,
        risk_score: aiReport.risk_score,
        data_categories: aiReport.data_categories,
        compliance_insights: aiReport.compliance_insights,
        dpdp_recommendations: aiReport.dpdp_recommendations,
        processor_summary: processorSummary,
        ai_summary: aiReport.ai_summary,
      })
      .eq("id", id);

    if (updateError) {
      console.error("Failed to update AI report in database:", updateError);
    }

    return NextResponse.json({
      summary: aiReport.ai_summary,
      recommendedAction: aiReport.dpdp_recommendations.split("\n")[0] || "Review and process within the legal deadline.",
      urgencyLevel: aiReport.risk_score.toLowerCase(),
      exposureScore: aiReport.exposure_score,
      riskScore: aiReport.risk_score,
      dataCategories: aiReport.data_categories,
      complianceInsights: aiReport.compliance_insights,
      dpdpRecommendations: aiReport.dpdp_recommendations,
      processorSummary: processorSummary,
    });
  } catch (err) {
    console.error("AI summary error:", err);
    return NextResponse.json({ message: "Failed to generate AI summary" }, { status: 500 });
  }
}
