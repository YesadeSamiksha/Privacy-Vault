import Link from "next/link";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <Layout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-12">
        <div className="max-w-3xl space-y-6">
          <div className="inline-flex items-center rounded-full border border-border px-3 py-1 text-sm font-medium text-muted-foreground mb-4">
            DPDP Act 2023 Compliance Platform
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-primary tracking-tight">
            Exercise Your Data Privacy Rights
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Securely submit and track your Data Subject Access Requests (DSAR). We ensure your personal data is handled transparently and in full compliance with the law.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <Link href="/submit">
            <Button size="lg" className="w-full sm:w-auto text-base">Submit a Request &rarr;</Button>
          </Link>
          <Link href="/track">
            <Button size="lg" variant="outline" className="w-full sm:w-auto text-base">Track Existing Request</Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-16 border-t border-border/50 text-left w-full mt-12">
          <div className="space-y-3">
            <h3 className="text-xl font-semibold">Right to Access</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">Request a comprehensive summary of all personal data we currently hold about you and how it is being processed.</p>
          </div>
          <div className="space-y-3">
            <h3 className="text-xl font-semibold">Right to Correction</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">Identify inaccuracies in your personal data and request immediate updates to ensure our records are exact.</p>
          </div>
          <div className="space-y-3">
            <h3 className="text-xl font-semibold">Right to Erasure</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">Request the permanent deletion of your personal data from our systems when it is no longer necessary.</p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
