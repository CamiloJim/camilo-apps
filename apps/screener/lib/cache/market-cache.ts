import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Caché compartido de respuestas de Yahoo Finance, en Supabase.
//
// Por qué no el caché nativo de Next.js: el Data Cache de Vercel se invalida en
// cada despliegue y no sobrevive a los cold starts de forma fiable. Como el
// objetivo es justamente no volver a golpear el rate limit de Yahoo (ya ocurrió
// el 2026-08-29), el caché tiene que persistir entre despliegues.
//
// Por qué es compartido y no por usuario: los datos de mercado son públicos e
// idénticos para todos. Cachear por usuario multiplicaría las llamadas por el
// número de alumnos, que es exactamente lo que se quiere evitar.

/** Cuánto vive cada tipo de dato, según cada cuánto cambia de verdad. */
export const TTL = {
  /** Estados financieros anuales: cambian una vez por trimestre. */
  fundamentals: 24 * 60 * 60,
  /** Precio y ratios: cambian en mercado abierto, pero un DCF no se hace al tick. */
  quote: 15 * 60,
  /** Tasa libre de riesgo (^TNX): diaria, y es una sola para toda la app. */
  riskFree: 12 * 60 * 60,
} as const;

let client: SupabaseClient | null | undefined;

/**
 * Cliente con service_role: la tabla solo deja escribir al servidor.
 * Si la variable no está configurada, el caché se desactiva por completo y la
 * app sigue funcionando — solo que pidiéndole todo a Yahoo cada vez.
 */
function getClient(): SupabaseClient | null {
  if (client !== undefined) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  client =
    url && serviceKey
      ? createClient(url, serviceKey, { auth: { persistSession: false } })
      : null;

  return client;
}

export function isCacheEnabled(): boolean {
  return getClient() !== null;
}

async function readCache<T>(key: string): Promise<T | null> {
  const supabase = getClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from("market_cache")
      .select("payload")
      .eq("cache_key", key)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (error || !data) return null;
    return data.payload as T;
  } catch {
    // Un fallo del caché nunca debe tumbar la consulta: se sigue a Yahoo.
    return null;
  }
}

async function writeCache(key: string, payload: unknown, ttlSeconds: number): Promise<void> {
  const supabase = getClient();
  if (!supabase) return;

  try {
    await supabase.from("market_cache").upsert(
      {
        cache_key: key,
        payload: payload as never,
        expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "cache_key" }
    );
  } catch {
    // Idem: si no se pudo guardar, la respuesta ya la tenemos.
  }
}

/**
 * Devuelve el valor cacheado si sigue vigente; si no, ejecuta `fetcher`,
 * guarda el resultado y lo devuelve.
 *
 * Un `null`/`undefined` del fetcher NO se cachea: normalmente significa
 * "ticker no encontrado" o un fallo transitorio, y cachear eso durante horas
 * convertiría un error puntual en uno persistente.
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const hit = await readCache<T>(key);
  if (hit !== null) return hit;

  const fresh = await fetcher();
  if (fresh != null) {
    await writeCache(key, fresh, ttlSeconds);
  }
  return fresh;
}
