import { getT } from "@/lib/i18n/server";
import type { Car } from "@/lib/types";

export default async function DealSummary({
  myCar,
  otherCar,
  otherName,
}: {
  myCar: Car | null;
  otherCar: Car | null;
  otherName: string;
}) {
  if (!myCar && !otherCar) return null;
  const { t } = await getT();

  // Both sides brought a car -> a swap match. Only one side did -> a sale match (the
  // buyer doesn't have a car in the deal).
  const isSwap = !!myCar && !!otherCar;

  if (!isSwap) {
    const saleCar = myCar ?? otherCar!;
    const iAmSeller = !!myCar;
    return (
      <div className="card p-4 mb-6 text-sm">
        <p className="font-medium mb-1">{t("deal.saleTitle")}</p>
        <p className="text-muted">
          {saleCar.make} {saleCar.model} {saleCar.year ?? ""} ·{" "}
          {saleCar.price ? `₪${saleCar.price}` : t("swipe.noPriceListed")}{" "}
          {iAmSeller ? t("deal.yourListing") : t("deal.theirListing", { name: otherName })}
        </p>
      </div>
    );
  }

  const bothPriced = myCar!.price != null && otherCar!.price != null;
  const diff = bothPriced ? Math.abs(myCar!.price! - otherCar!.price!) : null;
  const iPay = bothPriced && myCar!.price! < otherCar!.price!;
  const theyPay = bothPriced && otherCar!.price! < myCar!.price!;

  return (
    <div className="card p-4 mb-6 text-sm space-y-2">
      <p className="font-medium">{t("deal.swapTitle")}</p>
      <div className="flex justify-between text-muted">
        <span>{t("deal.yourCar", { make: myCar!.make, model: myCar!.model, year: myCar!.year ?? "" })}</span>
        <span>{myCar!.price != null ? `₪${myCar!.price}` : t("deal.noPrice")}</span>
      </div>
      <div className="flex justify-between text-muted">
        <span>
          {t("deal.theirCar", {
            name: otherName,
            make: otherCar!.make,
            model: otherCar!.model,
            year: otherCar!.year ?? "",
          })}
        </span>
        <span>{otherCar!.price != null ? `₪${otherCar!.price}` : t("deal.noPrice")}</span>
      </div>
      <div className="pt-2 border-t border-neutral-200 font-medium">
        {!bothPriced ? (
          <span className="text-muted font-normal">{t("deal.needBothPrices")}</span>
        ) : diff === 0 ? (
          <span>{t("deal.equalPrices")}</span>
        ) : iPay ? (
          <span>{t("deal.iPay", { name: otherName, amount: diff! })}</span>
        ) : theyPay ? (
          <span>{t("deal.theyPay", { name: otherName, amount: diff! })}</span>
        ) : null}
      </div>
    </div>
  );
}
