import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Inter } from "next/font/google";
import "./globals.css";
import "./sidebar-admin.css";
import { I18nProvider } from "@/lib/i18n/i18n-provider";
import type { Locale } from "@/lib/i18n/dictionaries";

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

// Locale lue au rendu (cookie) : le layout est bloquant, comme les layouts
// d'espace connecté. Sans ceci, le pré-rendu statique échoue sur cookies().
export const instant = false;

// Applique le thème mémorisé avant la première peinture (aucun flash).
const themeScript = `try{var t=localStorage.getItem('theme');if(t==='dark'||t==='light'){document.documentElement.dataset.theme=t}}catch(e){}`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Locale lue côté serveur : les composants clients sont rendus dans la bonne
  // langue dès le HTML initial (pas de bascule FR → EN après hydratation).
  const locale = (await cookies()).get("locale")?.value === "en" ? "en" : "fr";

  return (
    <html lang={locale} data-theme="light" suppressHydrationWarning className={inter.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body style={{ fontFamily: "var(--font-inter, 'Inter', system-ui, sans-serif)" }}>
        <I18nProvider initial={locale as Locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
