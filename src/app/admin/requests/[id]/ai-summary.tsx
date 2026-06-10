"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";

type AiResult = { summary: string; recommendedAction: string; urgencyLevel: string };

export function AiSummary({ requestId }: { requestId: string }) {
  const [result, setResult] = useState<AiResult | null>(null);
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
      <div className="px-6 pb-4 flex justify-end border-t border-border pt-4">
        <Button variant="outline" onClick={generate} disabled={isLoading}>
          {isLoading ? "Analyzing..." : "Generate Analysis"}
        </Button>
      </div>
      {error && <CardContent className="pt-0 text-sm text-destructive">{error}</CardContent>}
      {result && (
        <CardContent className="border-t border-border pt-6 bg-blue-50/20">
          <div className="space-y-6">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Summary</p>
              <p className="text-sm leading-relaxed">{result.summary}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Recommended Action</p>
              <p className="text-sm font-semibold text-primary">{result.recommendedAction}</p>
            </div>
            <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-sm border inline-block ${
              result.urgencyLevel === "high" ? "bg-red-50 text-red-700 border-red-200" :
              result.urgencyLevel === "medium" ? "bg-amber-50 text-amber-700 border-amber-200" :
              "bg-green-50 text-green-700 border-green-200"
            }`}>
              Priority: {result.urgencyLevel}
            </span>
          </div>
        </CardContent>
      )}
    </>
  );
}
