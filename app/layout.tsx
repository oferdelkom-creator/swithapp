import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SwitchApp - להחליף או למכור את הרכב שלך",
  description: "אפליקציית סווייפ להחלפה ומכירה של רכבים, בהתאמה למיקום שלך.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-neutral-50 text-neutral-900">
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
