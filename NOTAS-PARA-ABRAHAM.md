# Notas — 2026-08-29

## Qué se construyó (fase 1: Stock Screener)

App completa en `apps/screener/`, Next.js 16 + TypeScript + Tailwind, en el
repo `github.com/AbrahamRubioG/camilo-apps` (rama `main`).

- **Auth real** contra Supabase (email+contraseña, `@supabase/ssr`), con
  `proxy.ts` protegiendo todas las rutas salvo `/login`.
- **Lógica financiera portada 1:1** desde `dcf.py` y `screener.py` a
  TypeScript, con **14 tests unitarios** que pasan — WACC, proyección FCF,
  valor terminal, precio intrínseco, los 9 filtros del screener.
- **Fetch de datos de mercado desde Yahoo Finance** (no hay yfinance en JS):
  cliente propio con el patrón cookie+crumb que Yahoo exige hoy, más
  reintento con backoff. Verificado con éxito contra AAPL antes de que mis
  propias pruebas agotaran el rate limit de mi IP (ver más abajo).
- **Las 4 tabs completas**, con paridad de funcionalidad contra el original:
  Screener, Financials, DCF Model (sliders, 2 gauges, proyección, pie de
  composición), Sensitivity (heatmap 7×7).
- **Diseño nuevo y propio**, dark-first, con la paleta validada por la skill
  `dataviz` — no es el verde-terminal del Streamlit original.
- Build limpio, lint sin errores, 14/14 tests. Todo commiteado y pusheado en
  7 commits (revísalos con `git -C ~/Documents/camilo-apps log --oneline`).

## Ya hecho por mí (el coordinador), no por este agente

- Repo GitHub creado: `github.com/AbrahamRubioG/camilo-apps` (privado). **No
  pude crearlo bajo `marketingascendia`** — mi token no tiene rol de admin en
  esa org (mismo problema que con los 2 repos viejos de Streamlit). Cuando
  tengas minuto, o me das ese permiso, o lo transfieres tú desde GitHub.
- **Proyecto de Supabase creado**: `camilo-apps` (ref `ffgnwkwchjpkarwizdby`),
  org `marketingascendia's Org`, capa Free, **$0/mes confirmado**. Tabla
  `profiles` con RLS ya aplicada (cada usuario solo lee su propio perfil).

## Lo que falta — y por qué no me bloqueé por esto

1. **Crear tu usuario (y el de Camilo) en Supabase Auth.** Nadie tiene cuenta
   todavía — el login está construido y compila, pero no hay con quién
   probarlo de punta a punta. Dashboard de Supabase → proyecto `camilo-apps`
   → Authentication → Users → Add user. El `profiles` se crea solo (hay un
   trigger).
2. **Vercel: falta conectar GitHub como "Login Connection" en el equipo
   `nenecos`.** El link automático repo→proyecto falló con exactamente ese
   mensaje. Es un paso tuyo en el dashboard de Vercel (Account Settings →
   Login Connections). Después de eso, decirme y conecto el proyecto.
3. **Rate limit de Yahoo Finance por IP — hallazgo operativo, no bug.** El
   endpoint `getcrumb` de Yahoo empezó a responder 429 después de mis propias
   pruebas repetidas hoy (curl + tsx, varias decenas de llamadas en poco
   tiempo). **Encontré y arreglé un bug real en el camino**: si `getcrumb`
   respondía 429, el código lo guardaba en caché como si fuera un crumb
   válido durante 55 minutos, rompiendo TODA consulta posterior en silencio.
   Ya no pasa — ahora reintenta con backoff y lanza un error explícito si de
   verdad no consigue crumb, en vez de fallar callado.
   **Antes de dar la app por probada de punta a punta**, hay que reintentar
   el fetch real desde una IP distinta a la mía de desarrollo (por ejemplo ya
   desplegado en Vercel, que tiene su propia IP) — es muy probable que ahí no
   esté limitado. Si en producción también se topa con 429 seguido, la
   mitigación es cachear resultados por ticker unos minutos (no está
   construido, es fácil de añadir si hace falta).
4. **Sin probar visualmente en un navegador real** — no tengo acceso a uno
   desde este entorno. Compila y los tests pasan, pero nadie vio la UI
   renderizada. Revísala en cuanto tengas Supabase con tu usuario creado:
   `npm run dev` dentro de `apps/screener` y entra a `localhost:3000`.

## Decisiones que tomé sin preguntar (dentro de lo ya acordado, ninguna reabre nada)

- El gauge de "margen de seguridad" lo hice con `RadialBarChart` de Recharts
  (semicírculo), no un gauge nativo — Recharts no trae uno. Se ve y funciona
  como el original, solo cambia la librería por debajo.
- El heatmap de sensibilidad es una tabla HTML con color de fondo por celda
  (interpolación azul↔gris↔rojo), no un componente de heatmap de Recharts
  (no tiene uno nativo tampoco). Mismo resultado visual y funcional.
- `packages/ui` quedó vacío por ahora — los componentes compartidos
  (`components/ui.tsx`, `Gauge.tsx`) viven dentro de `apps/screener/` porque
  todavía no hay una segunda app que los necesite. Cuando arranque el
  Trading Tracker (fase 2), ahí sí se mueven al paquete compartido — no antes,
  para no construir abstracción sin un segundo consumidor real.
- El campo `beta` de la fórmula del WACC no lo expone Yahoo en los módulos
  gratuitos que uso (`price,summaryDetail,defaultKeyStatistics,financialData`).
  Lo dejé en `null` (el cálculo usa beta=1.0 por defecto, igual que el
  original cuando `info.get("beta")` venía vacío) — si hace falta el beta
  real, existe el módulo `defaultKeyStatistics` con más campos que no probé
  todos, o el WACC manual del sidebar lo compensa.

## Estado del build

✅ Compila limpio (`npm run build`) · ✅ 14/14 tests · ✅ lint sin errores ·
⚠️ Fetch de Yahoo verificado exitoso una vez, pendiente de reverificar en
un entorno sin rate-limit propio antes de darlo por 100% probado.

## Deploy verificado — 2026-08-29
Variables de entorno agregadas en Vercel (Production/Preview/Development). Confirmando que el deploy de producción las toma.
