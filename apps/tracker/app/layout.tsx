import type { Metadata } from "next";
import { Fraunces, Geist_Mono, Outfit } from "next/font/google";
import "./globals.css";

// Las dos fuentes del sitio de Camilo: Fraunces para títulos, Outfit para
// cuerpo. Verificado en vivo el 2026-08-30 en las custom properties de
// camilojimenez.com (--font-display / --font-body).
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

// El sitio no fija monoespaciada porque no muestra tablas de cifras. Aquí sí
// hacen falta: sin ancho fijo de dígito las columnas de números no se alinean.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Trading Tracker — Camilo Jiménez",
  description: "Bitácora y seguimiento de operaciones",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${outfit.variable} ${fraunces.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
