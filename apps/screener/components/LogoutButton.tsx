"use client";

import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@camilo-apps/supabase/client";

export function LogoutButton() {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();

  if (!supabase) return null;

  return (
    <button
      onClick={async () => {
        await supabase.auth.signOut();
        router.push("/login");
        router.refresh();
      }}
      className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--status-critical)] hover:text-[var(--status-critical)]"
    >
      Cerrar sesión
    </button>
  );
}
