import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Temporary diagnostic route - checks whether the seed cars' photo_urls actually
// resolve, from Vercel's network (this sandbox can't reach wikimedia.org to verify
// directly). Delete once the photo issue reported 2026-08-15 is confirmed fixed.
export async function GET() {
  const supabase = await createClient();
  const { data: cars } = await supabase
    .from("cars")
    .select("id, make, model, photo_urls")
    .eq("is_seed", false);

  const results = await Promise.all(
    (cars ?? []).map(async (c) => {
      const url = c.photo_urls?.[0];
      if (!url) return { id: c.id, make: c.make, model: c.model, url: null, status: "no-url" };
      try {
        const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(8000) });
        return {
          id: c.id,
          make: c.make,
          model: c.model,
          url,
          finalUrl: res.url,
          status: res.status,
          ok: res.ok,
          contentType: res.headers.get("content-type"),
        };
      } catch (e) {
        return { id: c.id, make: c.make, model: c.model, url, status: "fetch-error", error: String(e) };
      }
    })
  );

  return NextResponse.json(results);
}
