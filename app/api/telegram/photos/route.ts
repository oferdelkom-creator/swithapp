import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase/config";
import { validateTelegramInitData } from "@/lib/telegram/validateInitData";

const BUCKET = "telegram-vehicle-photos";
const MAX_FILES = 6;
const MAX_FILE_SIZE = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export async function POST(request: Request) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!botToken || !secretKey) return NextResponse.json({ error: "Upload is not configured" }, { status: 503 });

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  const verified = validateTelegramInitData(String(form.get("initData") ?? ""), botToken, 60 * 60, process.env.TELEGRAM_BOT_ID ?? "8875971815");
  if (!verified) return NextResponse.json({ error: "Invalid Telegram session" }, { status: 401 });
  const market = form.get("marketCountry") === "IL" ? "IL" : form.get("marketCountry") === "RU" ? "RU" : null;
  if (!market) return NextResponse.json({ error: "Invalid market" }, { status: 400 });

  const files = form.getAll("photos").filter((value): value is File => value instanceof File).slice(0, MAX_FILES);
  if (!files.length) return NextResponse.json({ error: "No photos supplied" }, { status: 400 });
  for (const file of files) {
    if (!ALLOWED_TYPES.has(file.type) || file.size <= 0 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Only JPG, PNG or WebP photos up to 8 MB are allowed" }, { status: 400 });
    }
  }

  const supabase = createClient(SUPABASE_URL, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: bucketLookupError } = await supabase.storage.getBucket(BUCKET);
  if (bucketLookupError) {
    const { error: createError } = await supabase.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_FILE_SIZE,
      allowedMimeTypes: [...ALLOWED_TYPES.keys()],
    });
    if (createError && !createError.message.toLowerCase().includes("already exists")) {
      console.error("telegram photo bucket", createError);
      return NextResponse.json({ error: "Photo storage unavailable" }, { status: 500 });
    }
  }

  const uploadedPaths: string[] = [];
  const urls: string[] = [];
  for (const file of files) {
    const extension = ALLOWED_TYPES.get(file.type)!;
    const path = `${market.toLowerCase()}/${verified.user.id}/${Date.now()}-${randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    if (error) {
      if (uploadedPaths.length) await supabase.storage.from(BUCKET).remove(uploadedPaths);
      console.error("telegram photo upload", error);
      return NextResponse.json({ error: "Photo upload failed" }, { status: 500 });
    }
    uploadedPaths.push(path);
    urls.push(supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
  }

  return NextResponse.json({ urls });
}

