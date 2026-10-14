import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runAssistant, validateChat, type AssistantCar } from "@/lib/assistant";

import { consumeVisitorLimit, getVisitorSession, requestBucket, visitorService } from "@/lib/visitorSession";

export const maxDuration = 60;

function publicCars(rows: Record<string, unknown>[]): AssistantCar[] {
  return rows.slice(0, 8).map((row) => ({ id: String(row.car_id ?? row.id), make: String(row.make), model: String(row.model), year: row.year as number | null, price: row.price as number | null, mileage: row.mileage as number | null, fuel_type: row.fuel_type as string | null, region: row.region as string | null }));
}

export async function POST(request: Request) {
  const fail = (code: string, status: number) => NextResponse.json({ error: code }, { status });
  const origin = request.headers.get("origin");
  try { if (!origin || new URL(origin).origin !== new URL(request.url).origin) return fail("invalid_origin", 403); } catch { return fail("invalid_origin", 403); }
  const raw = await request.text();
  if (raw.length > 16000) return fail("invalid_chat", 400);
  let body, messages;
  try { body = JSON.parse(raw); messages = validateChat(body.messages); } catch { return fail("invalid_chat", 400); }
  if (!process.env.OPENAI_API_KEY) return fail("not_configured", 503);
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  const profileResult = user ? await db.from("users").select("role,is_banned").eq("id", user.id).maybeSingle() : {data:null,error:null};
  const profile = profileResult.data;
  if (user && (profileResult.error || !profile || profile.is_banned)) return fail("not_allowed", 403);
  const business = body.mode === "business";
  if (business && (!profile || !["dealer", "importer"].includes(profile.role))) return fail("business_required", 403);
  let intent: string | undefined;
  let homeVisitor: Awaited<ReturnType<typeof getVisitorSession>> = null;
  try {
    if (body.homeConversation === true) {
      homeVisitor = await getVisitorSession();
      if(!homeVisitor)return fail('details_required',401);
      if(typeof body.conversationId!=='string'||!/^[0-9a-f-]{36}$/i.test(body.conversationId))return fail('invalid_chat',400);
      const {data:conversation,error}=await visitorService().from('visitor_conversations').select('intent,ended_at').eq('id',body.conversationId).eq('visitor_id',homeVisitor.id).maybeSingle();
      if(error)return fail('temporarily_unavailable',503);
      if(!conversation||conversation.ended_at)return fail('conversation_ended',409);
      intent=conversation.intent;
    }
    if (user) {
      const {data:allowed,error}=await db.rpc("consume_assistant_request");
      if(error)return fail("temporarily_unavailable",503);
      if(!allowed)return fail("hourly_limit",429);
    } else {
      const visitor=await getVisitorSession();
      if(!visitor)return fail("details_required",401);
      if(!visitor.intent)return fail("intent_required",400);
      intent=visitor.intent;
      if(!await consumeVisitorLimit(`chat:${visitor.id}`,15) || !await consumeVisitorLimit(requestBucket(request,"chat"),20) || !await consumeVisitorLimit("visitor_chat_global",150)) return fail("hourly_limit",429);
    }
  } catch { return fail("temporarily_unavailable",503); }
  try {
    const answer = await runAssistant({ messages, business, intent, locale: ["he", "en", "ru", "ar"].includes(body.locale) ? body.locale : "he", apiKey: process.env.OPENAI_API_KEY, model: process.env.OPENAI_ASSISTANT_MODEL,
      execute: async (name, args) => {
        if (name === "find_cars") {
          const { data, error } = await db.rpc("cars_for_sale", { my_id: user?.id ?? null, p_make: args.make, p_model: args.model, p_min_price: args.min_price, p_max_price: args.max_price, p_min_year: args.min_year, p_fuel_type: args.electric_only ? "Electric" : null }).limit(8);
          if (error) throw error;
          return { cars: publicCars(data ?? []), currency: "ILS", note: "Current listings; seller confirmation is required." };
        }
        if (name !== "my_business" || !business || !user) throw new Error("not_allowed");
        const [{ data: inventory, error }, { data: leads, error: leadsError }] = await Promise.all([
          db.from("cars").select("id,make,model,year,price,mileage,fuel_type,region,description,sold_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(40),
          db.rpc("get_dealer_leads_by_day", { my_id: user?.id ?? null }),
        ]);
        if (error || leadsError) throw new Error("data_unavailable");
        const rows = inventory ?? [];
        return { inventory: rows.map(({ description, ...car }) => ({ ...car, description: description?.slice(0, 500) })), lead_counts: leads ?? [], note: "Only your own inventory, maximum 40 most recent listings. Leads are aggregate counts; no customer contact details." };
      },
    });
    if(homeVisitor){
      const {data:saved,error}=await visitorService().rpc('append_visitor_conversation',{p_id:body.conversationId,p_visitor:homeVisitor.id,p_user:messages.at(-1)!.content,p_assistant:answer.text,p_filters:answer.searchFilters,p_no_match:answer.noMatch});
      if(error||!saved)return fail('temporarily_unavailable',503);
    }
    return NextResponse.json(answer, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = error instanceof Error && error.message === "ai_limit" ? "ai_limit" : "temporarily_unavailable";
    return fail(code, code === "ai_limit" ? 429 : 503);
  }
}
