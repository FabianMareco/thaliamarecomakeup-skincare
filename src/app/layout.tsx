import type { Metadata, Viewport } from "next";
import { Fraunces, Geist } from "next/font/google";
import "./globals.css";

const sans = Geist({ variable: "--font-sans-base", subsets: ["latin"] });
const display = Fraunces({ variable: "--font-display-base", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Thalia Mareco · Skincare & Makeup", template: "%s · Thalia Mareco" },
  description: "Tratamientos faciales y maquillaje profesional en Zona Tribunales, CABA. Reservá tu turno online.",
};

export const viewport: Viewport = {
  themeColor: "#faf6f3",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-AR" className={`${sans.variable} ${display.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
