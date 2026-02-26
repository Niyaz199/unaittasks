import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RegisterSW } from "@/components/pwa/register-sw";

export const metadata: Metadata = {
  title: "Задачник эксплуатации",
  description: "PWA для постановки и контроля задач по объектам",
  manifest: "/manifest.webmanifest",
  applicationName: "Задачник эксплуатации",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Задачник"
  }
};

export const viewport: Viewport = {
  themeColor: "#0f172a"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <RegisterSW />
        {children}
      </body>
    </html>
  );
}
