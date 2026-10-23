import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Thru Quant Core — Sovereign Oracle Hub",
  description: "High-density telemetry, multi-publisher consensus, and risk monitor for ThruVM",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#09090b] text-[#f8fafc] font-sans antialiased selection:bg-emerald-950 selection:text-emerald-300">
        {children}
      </body>
    </html>
  );
}
