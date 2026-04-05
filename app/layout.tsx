import type { Metadata, Viewport } from "next";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

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
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
