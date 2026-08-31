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
      className="cj-button cj-button--secondary"
    >
      Cerrar sesión
    </button>
  );
}
