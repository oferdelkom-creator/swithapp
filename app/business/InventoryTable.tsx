"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale } from "@/components/LocaleProvider";
import type { Car } from "@/lib/types";

type InventoryCar = Pick<
  Car,
  "id" | "make" | "model" | "year" | "photo_urls" | "for_sale" | "for_swap" | "sold_at" | "price"
>;

type Filter = "all" | "for_sale" | "for_swap" | "sold";

export default function InventoryTable({ inventory }: { inventory: InventoryCar[] }) {
  const { t } = useLocale();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const filtered = inventory.filter((c) => {
    if (filter === "for_sale" && !(c.for_sale && !c.sold_at)) return false;
    if (filter === "for_swap" && !(c.for_swap && !c.sold_at)) return false;
    if (filter === "sold" && !c.sold_at) return false;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      if (!`${c.make} ${c.model}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: t("business.filterAll") },
    { key: "for_sale", label: t("business.filterForSale") },
    { key: "for_swap", label: t("business.filterForSwap") },
    { key: "sold", label: t("business.filterSold") },
  ];

  return (
    <div>
      <div className="flex gap-2 mb-3 text-sm overflow-x-auto no-scrollbar">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`shrink-0 ${filter === f.key ? "btn-primary" : "btn-secondary"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("business.searchPlaceholder")}
        className="field mb-4"
      />

      <div className="space-y-3">
        {filtered.length ? (
          filtered.map((c) => (
            <Link
              key={c.id}
              href={`/cars/${c.id}/edit`}
              className={`card p-4 flex items-center gap-4 ${c.sold_at ? "opacity-60" : ""}`}
            >
              {c.photo_urls?.[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.photo_urls[0]} alt="" className="w-14 h-14 object-cover rounded-lg shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-neutral-100 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">
                  {c.make} {c.model} {c.year ?? ""}
                </p>
                <p className="text-xs text-muted">
                  {c.sold_at && <span className="text-neutral-700 font-medium">{t("cars.sold")} · </span>}
                  {c.for_sale ? t("cars.forSale") : ""}
                  {c.for_sale && c.for_swap ? " · " : ""}
                  {c.for_swap ? t("cars.forSwap") : ""}
                  {c.price ? ` · ₪${c.price}` : ""}
                </p>
              </div>
            </Link>
          ))
        ) : inventory.length ? (
          <p className="text-neutral-500 text-sm">{t("business.noResults")}</p>
        ) : (
          <p className="text-neutral-500 text-sm">{t("business.noInventory")}</p>
        )}
      </div>
    </div>
  );
}
