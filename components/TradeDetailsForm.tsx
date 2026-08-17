"use client";

import { useState } from "react";
import { useLocale } from "@/components/LocaleProvider";
import { getMakes, getModels, OTHER } from "@/lib/vehicleData";

const CAR_MAKES = getMakes("car").filter((make) => make !== OTHER);
const YEARS = Array.from({ length: new Date().getFullYear() - 1989 }, (_, index) => String(new Date().getFullYear() - index));

// The "describe your own car" fields shared by TradeDetailsModal (signed-in users)
// and QuickSignupModal's first step (signed-out users) - kept as one form instead of
// two copies so the two flows can't drift apart on field list or icebreaker wording.
export default function TradeDetailsForm({
  candidateMake,
  candidateModel,
  candidatePrice,
  submitLabel,
  onCancel,
  onSubmit,
}: {
  candidateMake: string;
  candidateModel: string;
  candidatePrice: number | null;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (icebreakerText: string) => void;
}) {
  const { t, locale } = useLocale();
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const isKnownMake = CAR_MAKES.includes(make);
  const modelOptions = isKnownMake ? getModels("car", make).filter((modelOption) => modelOption !== OTHER) : [];
  const ownCarPrice = Number(price);
  const hasEstimate = candidatePrice != null && Number.isFinite(ownCarPrice) && ownCarPrice > 0;
  const difference = hasEstimate ? candidatePrice - ownCarPrice : null;
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat(locale === "he" ? "he-IL" : locale === "ru" ? "ru-RU" : "en-US").format(amount);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isKnownMake || !modelOptions.includes(model) || !year) {
      setSelectionError(t("tradeModal.selectKnownVehicle"));
      return;
    }
    const lines = [
      t("tradeModal.icebreakerIntro", { make: candidateMake, model: candidateModel }),
      `${t("tradeModal.myCar")}: ${make} ${model} ${year}`.trim(),
      price ? `${t("tradeModal.price")}: ₪${price}` : null,
      notes || null,
    ];
    onSubmit(lines.filter((line): line is string => !!line).join("\n"));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="font-semibold">{t("tradeModal.title")}</p>
      <p className="text-neutral-500 text-xs">
        {t("tradeModal.subtitle", { make: candidateMake, model: candidateModel })}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <input
          required
          list="trade-car-makes"
          placeholder={t("tradeModal.make")}
          value={make}
          onChange={(e) => {
            setMake(e.target.value);
            setModel("");
            setSelectionError(null);
          }}
          className="field"
        />
        <datalist id="trade-car-makes">
          {CAR_MAKES.map((makeOption) => (
            <option key={makeOption} value={makeOption} />
          ))}
        </datalist>
        <input
          required
          disabled={!isKnownMake}
          list="trade-car-models"
          placeholder={t("tradeModal.model")}
          value={model}
          onChange={(e) => {
            setModel(e.target.value);
            setSelectionError(null);
          }}
          className="field"
        />
        <datalist id="trade-car-models">
          {modelOptions.map((modelOption) => (
            <option key={modelOption} value={modelOption} />
          ))}
        </datalist>
        <select
          required
          value={year}
          onChange={(e) => {
            setYear(e.target.value);
            setSelectionError(null);
          }}
          className="field"
        >
          <option value="" disabled>{t("tradeModal.year")}</option>
          {YEARS.map((yearOption) => <option key={yearOption} value={yearOption}>{yearOption}</option>)}
        </select>
        <input
          required
          type="number"
          min="0"
          placeholder={t("tradeModal.price")}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="field"
        />
      </div>
      <p className="text-xs text-neutral-500">{t("tradeModal.knownVehicleHint")}</p>
      {selectionError && <p className="text-xs text-red-600">{selectionError}</p>}
      {candidatePrice != null && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs space-y-1" aria-live="polite">
          <p className="font-semibold text-amber-900">{t("tradeModal.differenceTitle")}</p>
          {!hasEstimate ? (
            <p className="text-amber-800">{t("tradeModal.differenceHint")}</p>
          ) : difference === 0 ? (
            <p className="font-medium text-amber-900">{t("tradeModal.equalEstimate")}</p>
          ) : difference! > 0 ? (
            <p className="font-medium text-amber-900">
              {t("tradeModal.addEstimate", { amount: formatCurrency(difference!) })}
            </p>
          ) : (
            <p className="font-medium text-amber-900">
              {t("tradeModal.receiveEstimate", { amount: formatCurrency(Math.abs(difference!)) })}
            </p>
          )}
          <p className="text-amber-700">{t("tradeModal.differenceDisclaimer")}</p>
        </div>
      )}
      <textarea
        placeholder={t("tradeModal.notes")}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        className="field w-full"
      />
      <div className="flex gap-2 pt-1">
        <button type="submit" className="btn-primary flex-1">
          {submitLabel}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary">
          {t("tradeModal.cancel")}
        </button>
      </div>
    </form>
  );
}
