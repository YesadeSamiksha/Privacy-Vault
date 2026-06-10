import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { LogoutButton } from "./logout-button";

export async function Layout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="font-bold text-xl tracking-tight text-primary hover:opacity-80 transition-opacity">
            PrivacyVault.
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/track" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              Track Request
            </Link>
            <Link href="/compliance" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              Compliance
            </Link>
            {user ? (
              <div className="flex items-center gap-4 ml-4 pl-4 border-l border-border">
                <Link href="/admin" className="text-sm font-medium text-primary hover:underline">
                  Dashboard
                </Link>
                <LogoutButton />
              </div>
            ) : (
              <Link href="/admin/login" className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors ml-4">
                Admin
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {children}
      </main>
      <footer className="border-t border-border py-8 text-center">
        <p className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} PrivacyVault Platform. DPDP Act 2023 Compliant.
        </p>
      </footer>
    </div>
  );
}
