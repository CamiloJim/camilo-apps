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

## Caché de datos de mercado — 2026-08-30

Activo. Tabla `market_cache` en Supabase, con RLS: los autenticados leen, solo
el servidor escribe (con `SUPABASE_SERVICE_ROLE_KEY`). TTL por tipo de dato:
fundamentales 24 h, precio 15 min, tasa libre de riesgo 12 h.

Si la variable falta, el caché se desactiva solo y la app sigue funcionando
pidiéndole todo a Yahoo. `/api/diag` reporta cuál de los dos estados está.

---

# Fase 2 — Trading Tracker · 2026-08-30

## Qué quedó construido

App completa en `apps/tracker/`, mismo stack y mismo sistema visual que el
Screener. Cuatro páginas con paridad contra el Streamlit original: Registro,
Dashboard mensual, Resumen anual y Configuración.

Lo que de verdad cambia respecto al original: **los datos ya no se pierden**.
El Streamlit los guardaba en `st.session_state`, o sea en memoria del
navegador, y se borraban al recargar la página. El JSON del repo era un export
manual. Ahora todo persiste en Supabase (`trading_days` / `trading_config`,
con RLS por usuario), y tus 14 días reales de abril y mayo ya están cargados
y conciliados.

## Decisiones que tomé sin preguntar

1. **`getSemanas` corrige un fallo del original.** `get_all_weeks` descartaba
   los días hábiles anteriores al primer lunes del mes — en 2026 eso son el
   1, 2 y 3 de abril, y el 1 de mayo. No se podían registrar operaciones esos
   días. Ahora sí aparecen. Verifiqué que ninguno de tus 14 días reales caía
   ahí, así que no altera nada de lo ya registrado; lo único que cambia es que
   la numeración de semanas puede correrse un puesto en meses que no empiezan
   en lunes.

2. **El año ya no está fijo en 2026.** El original tenía `YEAR = 2026`
   hardcodeado. Ahora se toma del reloj, para que la app no caduque en enero.

3. **Un día en cero no crea fila.** Si pones todo a cero, la fila se borra en
   vez de guardarse vacía. Así la tabla contiene solo días con actividad real
   y el export no se llena de ruido.

4. **Guardado con debounce de 800 ms**, no en cada tecla. Si cierras o cambias
   de página con cambios pendientes, se fuerza el guardado antes de salir.

5. **Los 50 USD por punto** pasaron de estar sueltos dentro de la fórmula a una
   constante con nombre (`USD_POR_PUNTO` en `lib/trading/calc.ts`), con un
   comentario que explica qué son. **Si Camilo opera otro instrumento hay que
   cambiarlo ahí** — para el Nasdaq E-mini serían 20, no 50, y todos los
   resultados en dólares cambiarían.

6. **Se conservaron rarezas del original a propósito**, porque cambiarlas
   alteraría cifras ya registradas: el orden de los `if` de `get_insight` (los
   rangos se solapan; un día con tasa 90 y R/B 2 sale como "Operativa
   eficiente" solo porque esa condición se evalúa antes) y el fallback del R/B
   cuando no hubo operaciones perdedoras.

## packages/ui

Dejó de estar vacío. Subió **solo lo que usan las dos apps**: `Card`,
`SectionLabel`, `Kpi`, `fmtUsd` y los tokens de color. Lo que tiene un solo
consumidor se quedó donde estaba (`Badge`, `Verdict`, `marginColor`,
`fmtBillions` siguen en el Screener). El Screener quedó verificado después del
cambio: build limpio y sus 14 tests siguen pasando.

## Estado

✅ `apps/tracker`: build limpio, **21/21 tests**, lint sin errores.
✅ `apps/screener`: build limpio, 14/14 tests (verificado tras tocar packages/ui).

Dos de los 21 tests son conciliaciones contra tus datos reales: abril (13 ops,
23,75 pts, 1.122,50 USD) y mayo (10 ops, 41 pts, 2.000 USD). Si alguien rompe
la aritmética, esos tests lo cazan.

## Lo que falta y no depende de mí

1. **Crear el proyecto en Vercel y mover el dominio.** `tracker.camilojimenez.com`
   ya resuelve por DNS pero hoy sirve el Screener: hay que quitarlo de ese
   proyecto y apuntarlo al nuevo. Eso lo hace el coordinador, no yo.
2. **Nadie ha visto la app en un navegador todavía.** Compila y los tests pasan,
   pero la UI no se ha mirado con ojos humanos. Vale la pena abrir
   `npm run dev` en `apps/tracker` y revisar sobre todo la rejilla de Registro,
   que es la pantalla que más se usa.
3. **El Tracker no necesita `SUPABASE_SERVICE_ROLE_KEY`**, a diferencia del
   Screener: no tiene caché, escribe con la sesión del propio usuario y la RLS
   lo acota a sus filas. En Vercel solo hacen falta las dos variables públicas.

## Dominio del Tracker — 2026-08-30

`tracker.camilojimenez.com` movido del proyecto `camilo-screener` al nuevo
`camilo-tracker` en Vercel. El CNAME en QUIC.cloud no se tocó: apuntaba al
equipo, no a un proyecto concreto, así que validó solo.
