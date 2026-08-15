import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import LocaleProvider from "@/components/LocaleProvider";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return {
    title: t("meta.title"),
    description: t("meta.description"),
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale } = await getT();

  return (
    <html lang={locale} dir={locale === "he" ? "rtl" : "ltr"} className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <LocaleProvider locale={locale}>
          <Header />
          <main className="flex-1">{children}</main>
        </LocaleProvider>
      </body>
    </html>
  );
}
