"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale } from "@/components/LocaleProvider";
import { formatDate } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/translations";

export interface MatchPreview {
  match_id: string;
  other_id: string;
  other_name: string;
  status: string;
  created_at: string;
  my_car_id: string | null;
  my_car_make: string | null;
  my_car_model: string | null;
  other_car_id: string | null;
  other_car_make: string | null;
  other_car_model: string | null;
  other_car_price: number | null;
  other_car_photo: string | null;
  last_message_text: string | null;
  last_message_at: string | null;
  last_message_from_me: boolean;
  unread: boolean;
}

type Filter = "all" | "sale" | "swap";

function isSwap(m: MatchPreview) {
  return !!m.my_car_id && !!m.other_car_id;
}

export default function MatchesList({ matches, locale }: { matches: MatchPreview[]; locale: Locale }) {
  const { t } = useLocale();
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = matches.filter((m) => {
    if (filter === "sale") return !isSwap(m);
    if (filter === "swap") return isSwap(m);
    return true;
  });

  return (
    <div>
      <div className="flex gap-2 mb-4 text-sm">
        <button
          onClick={() => setFilter("all")}
          className={filter === "all" ? "btn-primary" : "btn-secondary"}
        >
          {t("matches.filterAll")}
        </button>
        <button
          onClick={() => setFilter("sale")}
          className={filter === "sale" ? "btn-primary" : "btn-secondary"}
        >
          {t("matches.filterSale")}
        </button>
        <button
          onClick={() => setFilter("swap")}
          className={filter === "swap" ? "btn-primary" : "btn-secondary"}
        >
          {t("matches.filterSwap")}
        </button>
      </div>

      <div className="space-y-3">
        {filtered.length ? (
          filtered.map((m) => {
            const swap = isSwap(m);
            const dealLabel = swap
              ? t("matches.swapLabel", {
                  myMake: m.my_car_make ?? "",
                  myModel: m.my_car_model ?? "",
                  otherMake: m.other_car_make ?? "",
                  otherModel: m.other_car_model ?? "",
                })
              : m.other_car_make
                ? t("matches.saleLabel", { make: m.other_car_make, model: m.other_car_model ?? "" })
                : m.my_car_make
                  ? t("matches.saleLabel", { make: m.my_car_make, model: m.my_car_model ?? "" })
                  : null;
            const preview = m.last_message_text
              ? `${m.last_message_from_me ? `${t("matches.you")}: ` : ""}${m.last_message_text}`
              : t("matches.noMessagesYet");

            return (
              <Link
                key={m.match_id}
                href={`/matches/${m.match_id}`}
                className="flex items-center gap-3 card px-4 py-3 hover:border-brand-blue"
              >
                {m.other_car_photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.other_car_photo} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-neutral-100 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium truncate">{m.other_name}</p>
                    <span className="text-xs text-muted shrink-0">
                      {formatDate(m.last_message_at ?? m.created_at, locale)}
                    </span>
                  </div>
                  {dealLabel && <p className="text-xs text-muted truncate">{dealLabel}</p>}
                  <p className="text-sm text-neutral-600 truncate">{preview}</p>
                </div>
                {m.unread && <span className="w-2.5 h-2.5 rounded-full bg-brand-orange shrink-0" />}
              </Link>
            );
          })
        ) : (
          <p className="text-neutral-500 text-sm">{t("matches.empty")}</p>
        )}
      </div>
    </div>
  );
}
