import type { Metadata, Viewport } from "next";
import { Fira_Code } from "next/font/google";
import "./globals.css";

const firaCode = Fira_Code({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-fira",
  display: "swap",
});

export const metadata: Metadata = {
  title: "HFT DASHBOARD ◈ BYBIT × POLYMARKET",
  description: "High-Frequency Trading Dashboard — Bybit / Polymarket Arbitrage Engine",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={firaCode.variable}>
      <body className="h-screen w-screen overflow-hidden bg-term-bg font-mono antialiased">
        {children}
      </body>
    </html>
  );
}
