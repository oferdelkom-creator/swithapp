import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import LikeBackButton from "./LikeBackButton";

interface IncomingLike {
  from_user_id: string;
  from_user_name: string;
  car_id: string;
  make: string;
  model: string;
  year: number | null;
  photo_urls: string[];
  liked_at: string;
}

export default async function LikesPage() {
  const supabase = await createClient();
  const { t } = await getT();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/likes");

  const { data: me } = await supabase
    .from("users")
    .select("premium_until")
    .eq("id", user.id)
    .maybeSingle<{ premium_until: string | null }>();

  const isPremium = !!me?.premium_until && new Date(me.premium_until) > new Date();

  const [likesResult, countResult] = await Promise.all([
    isPremium
      ? supabase.rpc("get_incoming_likes", { my_id: user.id })
      : Promise.resolve({ data: null }),
    !isPremium ? supabase.rpc("count_incoming_likes", { my_id: user.id }) : Promise.resolve({ data: null }),
  ]);
  const likes = likesResult.data as IncomingLike[] | null;
  const teaserCount = (countResult.data as number | null) ?? 0;

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-semibold mb-6">{t("likes.title")}</h1>

      {!isPremium ? (
        <div className="card p-6 text-center">
          <p className="text-sm text-neutral-600">
            {teaserCount > 0
              ? t("likes.teaserSome", { count: teaserCount })
              : t("likes.teaserNone")}
          </p>
          <p className="text-xs text-muted mt-3">{t("likes.premiumOnly")}</p>
        </div>
      ) : likes?.length ? (
        <div className="space-y-3">
          {likes.map((l) => (
            <div
              key={l.from_user_id + l.car_id}
              className="flex items-center justify-between card px-6 py-4"
            >
              <div>
                <p className="font-medium">{l.from_user_name}</p>
                <p className="text-sm text-neutral-500">
                  {l.make} {l.model} {l.year ?? ""}
                </p>
              </div>
              <LikeBackButton toUserId={l.from_user_id} carId={l.car_id} />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-neutral-500 text-sm">{t("likes.empty")}</p>
      )}
    </div>
  );
}
