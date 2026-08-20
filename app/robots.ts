import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/swipe", "/cars/", "/d/", "/business/join"],
      disallow: ["/admin", "/api", "/auth", "/business", "/cars", "/likes", "/login", "/matches", "/profile"],
    },
    host: SITE_URL,
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
