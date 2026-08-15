"use client";

import { useLocale } from "@/components/LocaleProvider";

export interface Stats {
  active_listings: number;
  total_likes_received: number;
  total_matches: number;
  likes_by_day: number[];
}

export default function ProfileStats({ stats }: { stats: Stats }) {
  const { t } = useLocale();
  const maxDay = Math.max(1, ...stats.likes_by_day);

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="card p-4">
        <p className="text-2xl font-semibold">{stats.total_likes_received}</p>
        <p className="text-xs text-muted mt-1">{t("profile.statLikes")}</p>
        <div className="flex items-end gap-1 h-10 mt-3">
          {stats.likes_by_day.map((count, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm bg-brand-orange/70"
              style={{ height: `${Math.max(8, (count / maxDay) * 100)}%` }}
            />
          ))}
        </div>
      </div>
      <div className="card p-4 flex flex-col justify-between">
        <div>
          <p className="text-2xl font-semibold">{stats.total_matches}</p>
          <p className="text-xs text-muted mt-1">{t("profile.statMatches")}</p>
        </div>
        <div className="mt-3">
          <p className="text-2xl font-semibold">{stats.active_listings}</p>
          <p className="text-xs text-muted mt-1">{t("profile.statActiveListings")}</p>
        </div>
      </div>
    </div>
  );
}
