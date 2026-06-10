"use client";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="text-sm font-medium text-muted-foreground hover:text-destructive transition-colors"
    >
      Sign out
    </button>
  );
}
