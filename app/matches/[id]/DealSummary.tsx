import type { Car } from "@/lib/types";

export default function DealSummary({
  myCar,
  otherCar,
  otherName,
}: {
  myCar: Car | null;
  otherCar: Car | null;
  otherName: string;
}) {
  if (!myCar && !otherCar) return null;

  // Both sides brought a car -> a swap match. Only one side did -> a sale match (the
  // buyer doesn't have a car in the deal).
  const isSwap = !!myCar && !!otherCar;

  if (!isSwap) {
    const saleCar = myCar ?? otherCar!;
    const iAmSeller = !!myCar;
    return (
      <div className="card p-4 mb-6 text-sm">
        <p className="font-medium mb-1">עסקת מכירה</p>
        <p className="text-muted">
          {saleCar.make} {saleCar.model} {saleCar.year ?? ""} ·{" "}
          {saleCar.price ? `₪${saleCar.price}` : "מחיר לא צוין"}
          {iAmSeller ? " (המודעה שלך)" : ` (המודעה של ${otherName})`}
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
      <p className="font-medium">עסקת החלפה</p>
      <div className="flex justify-between text-muted">
        <span>
          הרכב שלך: {myCar!.make} {myCar!.model} {myCar!.year ?? ""}
        </span>
        <span>{myCar!.price != null ? `₪${myCar!.price}` : "אין מחיר"}</span>
      </div>
      <div className="flex justify-between text-muted">
        <span>
          הרכב של {otherName}: {otherCar!.make} {otherCar!.model} {otherCar!.year ?? ""}
        </span>
        <span>{otherCar!.price != null ? `₪${otherCar!.price}` : "אין מחיר"}</span>
      </div>
      <div className="pt-2 border-t border-neutral-200 font-medium">
        {!bothPriced ? (
          <span className="text-muted font-normal">
            צריך לצרף מחיר לשני הרכבים כדי לחשב את הפרש התשלום.
          </span>
        ) : diff === 0 ? (
          <span>המחירים שווים - אין תשלום נוסף.</span>
        ) : iPay ? (
          <span>
            הרכב שלך זול יותר - אתה משלם ₪{diff} ל{otherName} להשלמת ההחלפה.
          </span>
        ) : theyPay ? (
          <span>
            הרכב של {otherName} זול יותר - {otherName} משלם/ת לך ₪{diff} להשלמת ההחלפה.
          </span>
        ) : null}
      </div>
    </div>
  );
}
