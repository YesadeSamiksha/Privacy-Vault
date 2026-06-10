"use client";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";
import { formatStatus, getStatusTheme, getDaysRemainingTheme, formatDate, formatDateTime } from "@/lib/utils";
import { DsarResults } from "./dsar-results";

type DsarStatus = {
  token: string; requestType: string; status: string; userName: string;
  createdAt: string; deadline: string | null; updatedAt: string;
  completedAt: string | null; daysRemaining: number | null;
  emailVerified: boolean; phoneVerified: boolean; userPhone: string | null;
  adminNote: string | null;
};

export default function TrackPage() {
  const [searchInput, setSearchInput] = useState("");
  const [activeToken, setActiveToken] = useState("");
  const [request, setRequest] = useState<DsarStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchRequest = useCallback(async (token: string) => {
    if (!token) return;
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/dsar/track/${token.toUpperCase()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Request not found");
      setRequest(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Request not found. Check your token.");
      setRequest(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!activeToken) return;
    fetchRequest(activeToken);
  }, [activeToken, fetchRequest]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchInput.trim()) setActiveToken(searchInput.trim());
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="text-center space-y-4 mb-10">
        <h1 className="text-3xl font-bold tracking-tight">Track Your Request</h1>
        <p className="text-muted-foreground">Enter your tracking token to see the real-time status of your request.</p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-3 max-w-lg mx-auto">
        <Input placeholder="e.g. TKN-1234" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} className="h-12 text-lg font-mono placeholder:font-sans" />
        <Button type="submit" size="lg" className="h-12 px-8" disabled={isLoading}>
          {isLoading ? "Searching..." : "Track"}
        </Button>
      </form>

      {error && (
        <div className="text-center mt-8 p-4 bg-destructive/5 text-destructive rounded-sm border border-destructive/20">{error}</div>
      )}

      {request && (
        <div className="mt-12 space-y-6">
          <Card>
            <CardContent className="p-8">

              {/* Header row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Tracking Token</p>
                  <h2 className="text-2xl font-mono font-bold">{request.token}</h2>
                </div>
                <span className={`self-start sm:self-auto px-4 py-1.5 rounded-full text-sm font-semibold border ${
                  ["under_review", "processing"].includes(request.status) ? "status-pulse " : ""
                }${getStatusTheme(request.status)}`}>
                  {formatStatus(request.status)}
                </span>
              </div>

              {/* Status Timeline */}
              {(() => {
                const stages = [
                  { key: "pending", label: "Pending", desc: "Request created, awaiting verification" },
                  { key: "submitted", label: "Submitted", desc: "Identity verified, awaiting review" },
                  { key: "under_review", label: "Under Review", desc: "Admin is reviewing your request" },
                  { key: "processing", label: "Processing", desc: "Request is being actioned" },
                  { key: "completed", label: "Completed", desc: "Request fully resolved" },
                ];
                const order = ["pending", "submitted", "under_review", "processing", "completed"];
                const isRejected = request.status === "rejected";
                const currentIdx = isRejected ? order.length : order.indexOf(request.status);
                return (
                  <div className="mb-8 pb-8 border-b border-border">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-5">Progress</p>
                    {isRejected && (
                      <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm font-semibold text-red-700">✗ Request Rejected</p>
                        <p className="text-xs text-red-600 mt-0.5">This request has been reviewed and could not be fulfilled.</p>
                      </div>
                    )}
                    <div className="space-y-0">
                      {stages.map((stage, idx) => {
                        const isDone = idx < currentIdx;
                        const isActive = !isRejected && idx === currentIdx;
                        const isPast = isRejected || idx > currentIdx;
                        return (
                          <div key={stage.key} className={`status-timeline-step flex items-start gap-4 pb-5 ${isDone ? "completed" : ""}`}>
                            <div className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center border-2 relative ${
                              isDone ? "bg-foreground border-foreground text-background" :
                              isActive ? "bg-background border-foreground text-foreground" :
                              "bg-background border-border text-muted-foreground"
                            }`}>
                              {isDone ? (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                              ) : (
                                <span className={`text-xs font-bold ${isActive ? "text-foreground" : "text-muted-foreground"}`}>{idx + 1}</span>
                              )}
                            </div>
                            <div className="pt-1.5">
                              <p className={`text-sm font-semibold ${isPast && !isDone ? "text-muted-foreground" : "text-foreground"}`}>{stage.label}</p>
                              {isActive && <p className="text-xs text-muted-foreground mt-0.5">{stage.desc}</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Info Cards — Step 8 */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="info-card">
                  <div className="flex items-center gap-2 mb-1.5">
                    <svg className="w-3.5 h-3.5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    <p className="text-xs text-muted-foreground font-medium">Request Type</p>
                  </div>
                  <p className="font-semibold text-sm capitalize">{request.requestType}</p>
                </div>
                <div className="info-card">
                  <div className="flex items-center gap-2 mb-1.5">
                    <svg className="w-3.5 h-3.5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    <p className="text-xs text-muted-foreground font-medium">Applicant</p>
                  </div>
                  <p className="font-semibold text-sm">{request.userName}</p>
                </div>
                <div className="info-card">
                  <div className="flex items-center gap-2 mb-1.5">
                    <svg className="w-3.5 h-3.5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    <p className="text-xs text-muted-foreground font-medium">Submitted On</p>
                  </div>
                  <p className="font-semibold text-sm">{formatDateTime(request.createdAt)}</p>
                </div>
                <div className="info-card">
                  <div className="flex items-center gap-2 mb-1.5">
                    <svg className="w-3.5 h-3.5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <p className="text-xs text-muted-foreground font-medium">Last Updated</p>
                  </div>
                  <p className="font-semibold text-sm">{formatDateTime(request.updatedAt)}</p>
                </div>
                {request.status !== "completed" && request.status !== "rejected" && (
                  <>
                    <div className="info-card">
                      <div className="flex items-center gap-2 mb-1.5">
                        <svg className="w-3.5 h-3.5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                        <p className="text-xs text-muted-foreground font-medium">Deadline</p>
                      </div>
                      <p className="font-semibold text-sm">{formatDate(request.deadline)}</p>
                    </div>
                    <div className="info-card">
                      <div className="flex items-center gap-2 mb-1.5">
                        <svg className="w-3.5 h-3.5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        <p className="text-xs text-muted-foreground font-medium">Time Remaining</p>
                      </div>
                      <p className={`font-semibold text-sm ${getDaysRemainingTheme(request.daysRemaining)}`}>
                        {request.daysRemaining != null ? `${request.daysRemaining} days` : "N/A"}
                      </p>
                    </div>
                  </>
                )}
                {request.completedAt && (
                  <div className="info-card col-span-2 sm:col-span-3 bg-green-50/60 border-green-100">
                    <div className="flex items-center gap-2 mb-1.5">
                      <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <p className="text-xs text-green-700 font-medium">Completed On</p>
                    </div>
                    <p className="font-semibold text-sm text-green-900">{formatDateTime(request.completedAt)}</p>
                  </div>
                )}
              </div>

              {/* AI Admin Update Note */}
              {request.adminNote && (
                <div className="mt-6 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                  <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-2">📋 Latest Update from Admin</p>
                  <p className="text-sm text-indigo-900 leading-relaxed">{request.adminNote}</p>
                </div>
              )}

              {/* Action banners */}
              {request.status === "pending" && !request.emailVerified && (
                <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm font-semibold text-amber-800 mb-1">⏳ Action Required — Verify Your Email</p>
                  <p className="text-sm text-amber-700">Check your inbox and click the verification link we sent. Your request will not be reviewed until email is verified.</p>
                </div>
              )}
              {request.status === "pending" && request.emailVerified && request.userPhone && !request.phoneVerified && (
                <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm font-semibold text-amber-800 mb-1">⏳ Action Required — Verify Your Phone</p>
                  <p className="text-sm text-amber-700">Your email is verified but phone verification is still pending. Go back to the submission form to complete it.</p>
                </div>
              )}
              {request.status === "submitted" && (
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm font-semibold text-blue-800 mb-1">✓ Identity Verified — Pending Admin Review</p>
                  <p className="text-sm text-blue-700">Your identity has been verified. Our team will review your request and update the status shortly.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {(request.status === "completed" || request.status === "processing") && (
            <DsarResults token={request.token} status={request.status} />
          )}
        </div>
      )}
    </div>
  );
}
