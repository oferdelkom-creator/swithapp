import type { Metadata } from "next";
import { SITE_URL } from "@/lib/constants";
import HomeAssistant from "@/components/HomeAssistant";

export function generateMetadata(): Metadata {
  return {
    alternates: { canonical: SITE_URL, languages: { ar: `${SITE_URL}/ar`, "x-default": SITE_URL } },
    openGraph: { url: SITE_URL },
  };
}

export default function HomePage(){ return <div className="min-h-[75vh] bg-gradient-to-b from-blue-50 via-white to-white"><HomeAssistant /></div>; }
