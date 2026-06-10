"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";

type AiResult = {
  summary: string;
  recommendedAction: string;
  urgencyLevel: string;
  exposureScore?: number;
  riskScore?: string;
  dataCategories?: string[];
  complianceInsights?: string;
  dpdpRecommendations?: string;
};

export function AiSummary({ requestId, initialData }: { requestId: string; initialData?: AiResult | null }) {
  const [result, setResult] = useState<AiResult | null>(initialData || null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/requests/${requestId}/ai-summary`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");
      setResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to generate analysis.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <div className="px-6 pb-4 flex justify-between items-center border-t border-border pt-4">
        <span className="text-xs text-muted-foreground font-medium">
          {result ? "Analysis loaded." : "No analysis run yet."}
        </span>
        <Button variant="outline" size="sm" onClick={generate} disabled={isLoading} className="text-xs font-semibold">
          {isLoading ? "Analyzing..." : result ? "🔄 Re-Analyze" : "Generate Analysis"}
        </Button>
      </div>
      {error && <CardContent className="pt-0 text-sm text-destructive">{error}</CardContent>}
      {result && (
        <CardContent className="border-t border-border pt-6 bg-secondary/10">
          <div className="space-y-6">
            
            {/* Score & Risk Badges */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="border border-border p-4 rounded-lg bg-background shadow-sm">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Privacy Exposure</span>
                  <span className="text-sm font-mono font-bold text-foreground">{result.exposureScore ?? 0}/100</span>
                </div>
                <div className="h-3 w-full bg-secondary rounded-full overflow-hidden relative">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${
                      (result.exposureScore ?? 0) >= 70 ? "bg-red-500" :
                      (result.exposureScore ?? 0) >= 35 ? "bg-amber-500" :
                      "bg-green-500"
                    }`}
                    style={{ width: `${result.exposureScore ?? 0}%` }}
                  />
                </div>
                <p className="text-[9px] text-muted-foreground mt-1.5">
                  Based on category sensitivity & downstream presence.
                </p>
              </div>

              <div className="border border-border p-4 rounded-lg bg-background flex flex-col justify-between shadow-sm">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Risk Level</span>
                  <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                    result.urgencyLevel === "high" || result.riskScore === "High" ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/50" :
                    result.urgencyLevel === "medium" || result.riskScore === "Medium" ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50" :
                    "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900/50"
                  }`}>
                    {result.riskScore || result.urgencyLevel}
                  </span>
                </div>
                <p className="text-[9px] text-muted-foreground mt-2">
                  Threat level determined under DPDP Act compliance rules.
                </p>
              </div>
            </div>

            {/* Exposed Data Categories */}
            {result.dataCategories && result.dataCategories.length > 0 && (
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Exposed Data Categories</p>
                <div className="flex flex-wrap gap-2">
                  {result.dataCategories.map((cat, idx) => (
                    <span key={idx} className="bg-secondary text-foreground text-xs font-semibold px-2.5 py-1 rounded border border-border">
                      {cat}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Summary */}
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Citizen-Facing Summary</p>
              <p className="text-sm leading-relaxed text-foreground bg-background p-3.5 border border-border rounded shadow-sm">{result.summary}</p>
            </div>

            {/* Compliance Insights */}
            {result.complianceInsights && (
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">DPDP Act Compliance Insights</p>
                <div className="text-sm leading-relaxed text-foreground bg-background p-3.5 border border-border rounded shadow-sm whitespace-pre-line">
                  {result.complianceInsights}
                </div>
              </div>
            )}

            {/* DPO Recommendations */}
            {result.dpdpRecommendations && (
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Action Plan for DPO</p>
                <div className="text-sm leading-relaxed text-primary bg-primary/5 p-3.5 border border-primary/20 rounded whitespace-pre-line">
                  {result.dpdpRecommendations}
                </div>
              </div>
            )}

          </div>
        </CardContent>
      )}
    </>
  );
}
