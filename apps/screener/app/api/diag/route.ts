import { NextResponse } from "next/server";
import { diagnose } from "@/lib/yahoo/client";

export const dynamic = "force-dynamic";

/**
 * Diagnóstico del flujo de Yahoo Finance desde la IP del servidor.
 * Existe porque desde una IP de desarrollo con rate limit no se puede
 * distinguir "Yahoo me bloqueó" de "el flujo de cookie está roto": ambos
 * fallaban con el mismo mensaje. Esto los separa.
 */
export async function GET() {
  const result = await diagnose();
  return NextResponse.json(result);
}
