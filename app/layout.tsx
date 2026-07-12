import type { Metadata } from "next";
import { League_Spartan } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";

const leagueSpartan = League_Spartan({
  subsets: ["latin"],
  weight: ["300", "400", "700"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "SISREP — JISSACRUZ",
  description: "Sistema de inventario, compras y ventas de repuestos — JISSACRUZ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={cn("font-sans", leagueSpartan.variable)}>
      <body className="antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
