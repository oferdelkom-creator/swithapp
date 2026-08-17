"use client";

import { useState } from "react";
import { useLocale } from "@/components/LocaleProvider";
import DealerDeck from "./DealerDeck";
import DealerCatalog from "./DealerCatalog";

type Tab = "swipe" | "catalog";

export default function DealerPageTabs({ userId, dealerId }: { userId: string | null; dealerId: string }) {
  const { t } = useLocale();
  const [tab, setTab] = useState<Tab>("swipe");

  return (
    <div>
      <div className="flex gap-2 mb-3 text-sm">
        <button
          onClick={() => setTab("swipe")}
          className={tab === "swipe" ? "chip-active px-4 py-2 text-sm" : "chip-inactive px-4 py-2 text-sm"}
        >
          {t("dealerPage.tabSwipe")}
        </button>
        <button
          onClick={() => setTab("catalog")}
          className={tab === "catalog" ? "chip-active px-4 py-2 text-sm" : "chip-inactive px-4 py-2 text-sm"}
        >
          {t("dealerPage.tabCatalog")}
        </button>
      </div>

      {tab === "swipe" ? (
        // Swiping one card at a time doesn't need the wider column its parent gets
        // for the grid tab - capped back to the mobile card width even on desktop.
        <div className="md:max-w-md md:mx-auto">
          <DealerDeck userId={userId} dealerId={dealerId} />
        </div>
      ) : (
        <DealerCatalog userId={userId} dealerId={dealerId} />
      )}
    </div>
  );
}
