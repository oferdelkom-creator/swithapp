// Fallback values so a fresh deployment (e.g. this session's own Vercel preview) works
// without manually configuring env vars first - the Vercel MCP tools available in this
// session have no way to set project environment variables. These are the switchapp
// project's publishable values (a publishable anon key is meant to be public, same as
// what's in .env.local.example), not secrets. Real deployments should still set
// NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY properly - this is a fallback,
// not a replacement.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://hltpqflqngtrmprayyvd.supabase.co";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "sb_publishable_cV_LDTHry1FAhtZsj8zukg_DyEexiS7";
