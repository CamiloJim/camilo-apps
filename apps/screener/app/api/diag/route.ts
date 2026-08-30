import { NextResponse } from "next/server";
import { diagnose } from "@/lib/yahoo/client";
import { isCacheEnabled } from "@/lib/cache/market-cache";

export const dynamic = "force-dynamic";

/**
 * Diagnóstico del flujo de Yahoo Finance desde la IP del servidor.
 * Existe porque desde una IP de desarrollo con rate limit no se puede
 * distinguir "Yahoo me bloqueó" de "el flujo de cookie está roto": ambos
 * fallaban con el mismo mensaje. Esto los separa.
 */
export async function GET() {
  const yahoo = await diagnose();
  return NextResponse.json({
    ...yahoo,
    cache: isCacheEnabled()
      ? "activo (Supabase)"
      : "desactivado — falta SUPABASE_SERVICE_ROLE_KEY",
  });
}
