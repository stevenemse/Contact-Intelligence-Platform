import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n/i18n-provider";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Contact Intelligence Platform",
  description:
    "Centralisez, nettoyez, dédupliquez, segmentez et exportez vos bases de contacts.",
  keywords: ["CRM", "contacts", "import CSV", "déduplication", "Cameroun", "Afrique"],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={inter.variable}>
      <body style={{ fontFamily: "var(--font-inter, 'Inter', system-ui, sans-serif)" }}>
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
