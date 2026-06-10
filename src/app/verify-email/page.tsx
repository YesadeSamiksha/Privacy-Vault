"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Verifying your email securely...");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("No verification token provided. Check your email link.");
      return;
    }

    async function verify() {
      try {
        const res = await fetch(`/api/dsar/verify-email?token=${token}`);
        const data = await res.json();
        
        if (!res.ok) {
          throw new Error(data.message || "Failed to verify email");
        }

        setStatus("success");
        setMessage("Success! Your identity point has been verified. Your request is fully submitted!");
      } catch (e: unknown) {
        setStatus("error");
        setMessage(e instanceof Error ? e.message : "An error occurred during verification");
      }
    }

    verify();
  }, [token]);

  return (
    <div className="max-w-md mx-auto mt-20">
      <Card className={status === "success" ? "border-green-200" : status === "error" ? "border-red-200" : ""}>
        <CardHeader className="text-center pb-2">
          {status === "loading" && (
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="animate-spin text-2xl">⏳</span>
            </div>
          )}
          {status === "success" && (
            <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">✓</div>
          )}
          {status === "error" && (
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">✗</div>
          )}
          <CardTitle className="text-2xl">
            {status === "loading" ? "Verifying Email" : status === "success" ? "Email Verified" : "Verification Failed"}
          </CardTitle>
          <CardDescription className="text-base mt-2">{message}</CardDescription>
        </CardHeader>
        <CardContent className="text-center pt-6">
          <div className="flex justify-center gap-4">
            <Link href="/track"><Button>Track Request</Button></Link>
            <Link href="/"><Button variant="outline">Return Home</Button></Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="text-center mt-20">Loading...</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
