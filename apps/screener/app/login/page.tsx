"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@camilo-apps/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!supabase) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="cj-widget max-w-md !p-8 text-center">
          <h1 className="m-0 font-[family-name:var(--font-display)] text-[length:var(--text-title-md)] font-semibold text-[var(--text-primary)]">
            Supabase no configurado
          </h1>
          <p className="text-[length:var(--text-md)] text-[var(--text-secondary)]">
            Faltan <code>NEXT_PUBLIC_SUPABASE_URL</code> y{" "}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> en el entorno. Copia{" "}
            <code>.env.local.example</code> a <code>.env.local</code> y completa los
            valores del proyecto de Supabase.
          </p>
        </div>
      </main>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signInError } = await supabase!.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    setLoading(false);

    if (signInError) {
      setError("El correo o la contraseña no coinciden. Verifica tus datos.");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="cj-widget w-full max-w-sm !p-8">
        <div className="cj-brand">
          <strong>
            Portal de <em>Inversiones</em>
          </strong>
          <span>Stock Screener &amp; DCF Analyzer — Camilo Jiménez</span>
        </div>

        <div className="space-y-4">
          <div>
            <label className="cj-section-label mb-1 block" htmlFor="email">
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ejemplo@correo.com"
              className="cj-input"
            />
          </div>
          <div>
            <label className="cj-section-label mb-1 block" htmlFor="password">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="cj-input"
            />
          </div>
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-md border border-[var(--status-critical)]/40 bg-[var(--status-critical)]/10 px-3 py-2 text-[length:var(--text-md)] text-[var(--status-critical)]"
          >
            {error}
          </p>
        )}

        <button type="submit" disabled={loading} className="cj-button cj-button--primary w-full">
          {loading ? "Ingresando…" : "Ingresar"}
        </button>

        <p className="text-center text-[length:var(--text-sm)] text-[var(--text-muted)]">
          Las cuentas las crea un administrador. Si no tienes acceso, contacta al
          Equipo de Soporte.
        </p>
      </form>
    </main>
  );
}
