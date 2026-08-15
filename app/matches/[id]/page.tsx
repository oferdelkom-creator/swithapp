import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Car, Match, Message } from "@/lib/types";
import ChatThread from "./ChatThread";
import DealSummary from "./DealSummary";

export default async function MatchThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/matches/${id}`);

  const { data: match } = await supabase.from("matches").select("*").eq("id", id).maybeSingle<Match>();
  if (!match || (match.user_a_id !== user.id && match.user_b_id !== user.id)) notFound();

  const isUserA = match.user_a_id === user.id;
  const otherId = isUserA ? match.user_b_id : match.user_a_id;
  const myAgreed = isUserA ? match.user_a_agreed_to_call : match.user_b_agreed_to_call;
  const otherAgreed = isUserA ? match.user_b_agreed_to_call : match.user_a_agreed_to_call;
  const myCarId = isUserA ? match.user_a_car_id : match.user_b_car_id;
  const otherCarId = isUserA ? match.user_b_car_id : match.user_a_car_id;

  const [{ data: otherUser }, { data: messages }, { data: contact }, { data: myCar }, { data: otherCar }] =
    await Promise.all([
      supabase.from("users").select("name").eq("id", otherId).maybeSingle<{ name: string }>(),
      supabase
        .from("messages")
        .select("*")
        .eq("match_id", id)
        .order("created_at", { ascending: true })
        .returns<Message[]>(),
      supabase.from("user_contacts").select("phone").eq("user_id", otherId).maybeSingle<{ phone: string }>(),
      myCarId
        ? supabase.from("cars").select("*").eq("id", myCarId).maybeSingle<Car>()
        : Promise.resolve({ data: null }),
      otherCarId
        ? supabase.from("cars").select("*").eq("id", otherCarId).maybeSingle<Car>()
        : Promise.resolve({ data: null }),
    ]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-semibold mb-1">{otherUser?.name ?? "משתמש"}</h1>
      <p className="text-muted text-sm mb-6">
        {myAgreed && otherAgreed && contact?.phone
          ? `טלפון: ${contact.phone}`
          : "שני הצדדים צריכים להסכים כדי לחשוף מספר טלפון."}
      </p>

      <DealSummary myCar={myCar} otherCar={otherCar} otherName={otherUser?.name ?? "הצד השני"} />

      <ChatThread
        matchId={id}
        myId={user.id}
        otherId={otherId}
        initialMessages={messages ?? []}
        myAgreedToCall={myAgreed}
        isUserA={isUserA}
      />
    </div>
  );
}
