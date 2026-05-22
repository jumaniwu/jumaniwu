import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HFT Dashboard | Bybit × Polymarket",
  description: "High-Frequency Trading Dashboard — Bybit / Polymarket Arbitrage",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="h-screen w-screen overflow-hidden bg-term-bg font-mono">
        {children}
      </body>
    </html>
  );
}
