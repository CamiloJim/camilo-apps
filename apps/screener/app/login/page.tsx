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
        <div className="max-w-md rounded-lg border border-[var(--border)] bg-[var(--surface-1)] p-8 text-center">
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">
            Supabase no configurado
          </h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
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
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg border border-[var(--border)] bg-[var(--surface-1)] p-8"
      >
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">
          Portal de Inversiones
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Stock Screener &amp; DCF Analyzer — Camilo Jiménez
        </p>

        <div className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
              Correo electrónico
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ejemplo@correo.com"
              className="w-full rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--series-1)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
              Contraseña
            </label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--series-1)]"
            />
          </div>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-md border border-[var(--status-critical)]/40 bg-[var(--status-critical)]/10 px-3 py-2 text-sm text-[var(--status-critical)]"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-md bg-[var(--series-1)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Ingresando…" : "Ingresar"}
        </button>

        <p className="mt-4 text-center text-xs text-[var(--text-muted)]">
          Las cuentas las crea un administrador. Si no tienes acceso, contacta al
          Equipo de Soporte.
        </p>
      </form>
    </main>
  );
}
