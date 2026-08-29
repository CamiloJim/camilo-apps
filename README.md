# Camilo Apps

Monorepo con las dos apps de Camilo Jimenez, reescritas en Next.js para reemplazar
las versiones en Streamlit (repos `CamiloJimenez-stockscreener` y
`CamiloJimenez-TradingTracker`, hoy privados).

## Apps

- `apps/screener` — Stock Screener + DCF Analyzer
- `apps/tracker` — Trading Tracker (fase 2, no iniciada)

## Paquetes compartidos

- `packages/ui` — componentes y sistema de diseño compartido
- `packages/supabase` — cliente tipado + queries

## Stack

Next.js 15 (App Router) + TypeScript + Tailwind + Supabase (Auth + Postgres) + Vercel.
