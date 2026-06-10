"use client";
import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const schema = z.object({
  userName: z.string().min(2, "Full name is required"),
  userEmail: z.string().email("Invalid email address"),
  userPhone: z.string().optional(),
  requestType: z.enum(["access", "correction", "erasure"]),
  requestDetails: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function SubmitPage() {
  const [successData, setSuccessData] = useState<{ token: string; deadline?: string | null; email: string } | null>(null);
  const [serverError, setServerError] = useState("");
  const [isPending, setIsPending] = useState(false);

  // OTP flow states
  const [otpSent, setOtpSent] = useState(false);
  const [otpValue, setOtpValue] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [otpError, setOtpError] = useState("");

  // Saved from DB record created during OTP step
  const [correctionFields, setCorrectionFields] = useState<Record<string, string>>({});
  const [tempRequestId, setTempRequestId] = useState<string | null>(null);
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [tempDeadline, setTempDeadline] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { userName: "", userEmail: "", userPhone: "", requestType: "access", requestDetails: "" },
  });

  const watchPhone = form.watch("userPhone");

  // Step 1: Create a temp pending record just to attach OTP, then send OTP
  async function handleSendOtp() {
    const values = form.getValues();
    if (!values.userPhone || values.userPhone.length < 10) {
      setServerError("Please enter a valid phone number.");
      return;
    }
    const valid = await form.trigger(["userName", "userEmail"]);
    if (!valid) return;

    setIsSendingOtp(true);
    setServerError("");

    try {
      // Create temp pending record in DB to attach OTP to
      const res = await fetch("/api/dsar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create request");

      setTempRequestId(data.id);
      setTempToken(data.token);
      setTempDeadline(data.deadline ?? null);

      // Send OTP to phone
      const otpRes = await fetch("/api/dsar/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: data.id, phone: values.userPhone }),
      });
      const otpData = await otpRes.json();
      if (!otpRes.ok) throw new Error(otpData.message || "Failed to send OTP");

      setOtpSent(true);
    } catch (e: unknown) {
      setServerError(e instanceof Error ? e.message : "Failed to send OTP.");
    } finally {
      setIsSendingOtp(false);
    }
  }

  // Step 2: Verify OTP
  async function handleVerifyOtp() {
    if (otpValue.length !== 6) {
      setOtpError("OTP must be exactly 6 digits.");
      return;
    }
    setIsVerifying(true);
    setOtpError("");
    try {
      const res = await fetch("/api/dsar/verify-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: tempRequestId, otp: otpValue }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Invalid OTP");
      setPhoneVerified(true);
      setOtpSent(false);
      setOtpError("");
    } catch (e: unknown) {
      setOtpError(e instanceof Error ? e.message : "Failed to verify OTP.");
      setOtpValue("");
    } finally {
      setIsVerifying(false);
    }
  }

  // Step 3: Final submit
  async function onSubmit(values: FormValues) {
    if (values.userPhone && values.userPhone.length >= 10 && !phoneVerified) {
      setServerError("Please verify your phone number before submitting.");
      return;
    }

    setIsPending(true);
    setServerError("");

    // Encode correction fields as JSON if this is a correction request
    const nonEmptyCorrections = Object.fromEntries(
      Object.entries(correctionFields).filter(([, v]) => v.trim() !== "")
    );
    const encodedDetails = values.requestType === "correction"
      ? JSON.stringify({ corrections: nonEmptyCorrections, additional: values.requestDetails ?? "" })
      : values.requestDetails;

    try {
      // Phone was verified — record already exists, PATCH it with the currently selected requestType
      if (tempRequestId && phoneVerified && tempToken) {
        const patchRes = await fetch("/api/dsar", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: tempRequestId,
            requestType: values.requestType,
            requestDetails: encodedDetails,
          }),
        });
        if (!patchRes.ok) {
          const d = await patchRes.json();
          throw new Error(d.message || "Failed to update request");
        }
        setSuccessData({ token: tempToken, deadline: tempDeadline, email: values.userEmail });
        return;
      }

      // No phone — create fresh record now
      const res = await fetch("/api/dsar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, requestDetails: encodedDetails }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to submit");
      setSuccessData({ token: data.token, deadline: data.deadline, email: values.userEmail });
    } catch (e: unknown) {
      setServerError(e instanceof Error ? e.message : "Failed to submit request.");
    } finally {
      setIsPending(false);
    }
  }

  if (successData) {
    return (
      <div className="max-w-2xl mx-auto mt-12">
        <Card className="border-green-200">
          <CardHeader className="text-center pb-2">
            <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">✓</div>
            <CardTitle className="text-2xl">Request Submitted Successfully</CardTitle>
            <CardDescription className="text-base mt-2">Your request has been received.</CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-8 pt-6">
            <div className="bg-secondary/50 p-8 rounded-lg border border-border">
              <p className="text-sm text-muted-foreground uppercase tracking-widest font-semibold mb-3">Your Tracking Token</p>
              <div className="text-4xl sm:text-5xl font-mono font-bold text-primary tracking-wider">{successData.token}</div>
              <p className="text-sm text-muted-foreground mt-4">Save this token to track your request status.</p>
            </div>

            <div className="bg-blue-50/50 p-6 rounded-lg border border-blue-100 text-left">
              <h3 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h8" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /><path d="m16 19 2 2 4-4" /></svg>
                Action Required: Verify Your Email
              </h3>
              <p className="text-sm text-blue-700">
                A verification link has been sent to <strong>{successData.email}</strong>.
                Your request is <span className="font-semibold">Pending — Awaiting Your Email Verification</span>.
                It will not be reviewed by our team until you click the link.
              </p>
            </div>

            <div className="bg-amber-50/50 p-4 rounded-lg border border-amber-100 text-left text-sm text-amber-800">
              <strong>What happens next?</strong>
              <ol className="mt-2 space-y-1 list-decimal list-inside">
                <li>You verify your email → status becomes <strong>Submitted</strong></li>
                <li>Our team reviews it → status becomes <strong>Under Review</strong></li>
                <li>We process your request → status becomes <strong>Processing</strong></li>
                <li>Request resolved → status becomes <strong>Completed</strong></li>
              </ol>
            </div>

            {successData.deadline && (
              <div className="text-sm">
                <span className="text-muted-foreground">Estimated completion by: </span>
                <span className="font-semibold">{new Date(successData.deadline).toLocaleDateString()}</span>
              </div>
            )}
            <div className="flex justify-center gap-4 pt-4">
              <Link href="/track"><Button>Track Request</Button></Link>
              <Link href="/"><Button variant="outline">Return Home</Button></Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 border border-primary/10 mb-4">
          <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span className="text-sm font-semibold text-primary">DPDP Act 2023 Compliant</span>
        </div>
        <h1 className="text-4xl font-bold tracking-tight mb-3">Submit a Request</h1>
        <p className="text-muted-foreground text-lg">Fill out the form below to exercise your data rights under the DPDP Act.</p>
      </div>
      <Card className="card-gradient">
        <CardContent className="pt-8">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-7">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2.5">
                <Label htmlFor="userName" className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Full Name *
                </Label>
                <Input id="userName" placeholder="John Doe" {...form.register("userName")} className={form.formState.errors.userName ? "border-destructive" : ""} />
                {form.formState.errors.userName && <p className="text-sm text-destructive flex items-center gap-1"><span>⚠</span>{form.formState.errors.userName.message}</p>}
              </div>
              <div className="space-y-2.5">
                <Label htmlFor="userEmail" className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Email Address *
                </Label>
                <Input id="userEmail" type="email" placeholder="john@example.com" {...form.register("userEmail")} className={form.formState.errors.userEmail ? "border-destructive" : ""} />
                {form.formState.errors.userEmail && <p className="text-sm text-destructive flex items-center gap-1"><span>⚠</span>{form.formState.errors.userEmail.message}</p>}
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2.5">
                <Label htmlFor="userPhone" className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  Phone Number
                </Label>

                {/* Phone input row */}
                <div className="flex gap-2">
                  <Input
                    id="userPhone"
                    placeholder="+91 98765 43210"
                    disabled={phoneVerified || otpSent}
                    {...form.register("userPhone")}
                  />
                  {watchPhone && watchPhone.length >= 10 && !phoneVerified && !otpSent && (
                    <Button type="button" variant="outline" onClick={handleSendOtp} disabled={isSendingOtp}>
                      {isSendingOtp ? "Sending..." : "Send OTP"}
                    </Button>
                  )}
                  {phoneVerified && (
                    <div className="flex items-center text-green-600 bg-green-50 px-3 rounded-md text-sm font-medium border border-green-200 whitespace-nowrap">
                      ✓ Verified
                    </div>
                  )}
                </div>

                {/* OTP input — always visible once OTP is sent, until verified */}
                {otpSent && !phoneVerified && (
                  <div className="mt-3 p-5 bg-gradient-to-br from-blue-50 to-indigo-50/30 rounded-lg border-2 border-blue-200 space-y-3 shadow-sm">
                    <p className="text-sm text-blue-800 font-semibold flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      Enter the 6-digit OTP sent to your phone
                    </p>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter 6-digit OTP"
                        value={otpValue}
                        onChange={(e) => { setOtpValue(e.target.value.replace(/\D/g, "").slice(0, 6)); setOtpError(""); }}
                        maxLength={6}
                        className={`bg-background font-mono tracking-widest text-center text-lg ${otpError ? "border-destructive" : ""}`}
                      />
                      <Button
                        type="button"
                        onClick={handleVerifyOtp}
                        disabled={isVerifying || otpValue.length !== 6}
                      >
                        {isVerifying ? "Verifying..." : "Verify"}
                      </Button>
                    </div>
                    {otpError && (
                      <p className="text-sm text-destructive flex items-center gap-1.5 font-medium">
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        {otpError}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={isSendingOtp}
                      className="text-xs text-blue-600 underline underline-offset-2 hover:text-blue-800 disabled:opacity-50"
                    >
                      {isSendingOtp ? "Sending..." : "Resend OTP"}
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-2.5 sm:col-span-2">
                <Label className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Request Type *
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {([
                    {
                      value: "access", label: "Right to Access", desc: "Get a copy of your personal data", icon: (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      )
                    },
                    {
                      value: "correction", label: "Right to Correction", desc: "Fix inaccurate data we hold", icon: (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      )
                    },
                    {
                      value: "erasure", label: "Right to Erasure", desc: "Delete your data permanently", icon: (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      )
                    },
                  ] as const).map(({ value, label, desc, icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => form.setValue("requestType", value)}
                      className={`request-type-card text-left ${form.watch("requestType") === value ? "selected" : ""}`}
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2.5 ${value === "access" ? "bg-blue-50 text-blue-600" :
                          value === "correction" ? "bg-amber-50 text-amber-600" :
                            "bg-red-50 text-red-600"
                        }`}>{icon}</div>
                      <p className="font-semibold text-sm text-foreground">{label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                    </button>
                  ))}
                </div>
                <input type="hidden" {...form.register("requestType")} />
              </div>
            </div>

            {form.watch("requestType") === "correction" && (
              <div className="space-y-3 p-4 bg-amber-50/60 border-2 border-amber-200 rounded-lg">
                <p className="text-sm font-semibold text-amber-800 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  What needs to be corrected? (fill in new values)
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {([
                    { key: "full_name", label: "Full Name", placeholder: "Correct full name" },
                    { key: "email", label: "Email", placeholder: "Correct email address" },
                    { key: "phone", label: "Phone", placeholder: "Correct phone number" },
                    { key: "address", label: "Address", placeholder: "Correct address" },
                  ] as const).map(({ key, label, placeholder }) => (
                    <div key={key} className="space-y-1">
                      <label className="text-xs font-semibold text-amber-700 uppercase tracking-wide">{label}</label>
                      <input
                        type="text"
                        placeholder={placeholder}
                        value={correctionFields[key] ?? ""}
                        onChange={(e) => setCorrectionFields((prev) => ({ ...prev, [key]: e.target.value }))}
                        className="w-full border border-amber-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white placeholder:text-amber-300/70"
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-amber-700/70">Leave a field blank if it does not need correction.</p>
              </div>
            )}

            <div className="space-y-2.5">
              <Label htmlFor="requestDetails" className="flex items-center gap-2">
                <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                </svg>
                {form.watch("requestType") === "correction" ? "Additional Context (Optional)" : "Additional Details (Optional)"}
              </Label>
              <Textarea id="requestDetails" placeholder="Provide any specific context..." className="min-h-[120px]" {...form.register("requestDetails")} />
            </div>

            {serverError && (
              <div className="p-4 bg-destructive/10 border-2 border-destructive/30 text-destructive text-sm rounded-lg flex items-start gap-3 shadow-sm">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{serverError}</span>
              </div>
            )}

            <Button
              type="submit"
              className="w-full text-base font-semibold"
              size="lg"
              disabled={isPending || (!!watchPhone && watchPhone.length >= 10 && !phoneVerified)}
            >
              {isPending ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Submitting...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Submit Request
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </span>
              )}
            </Button>

            {watchPhone && watchPhone.length >= 10 && !phoneVerified && (
              <p className="text-center text-sm text-amber-600">⚠ Verify your phone number to enable submission</p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
