"use client";

import { useState } from "react";
import { useLocale } from "@/components/LocaleProvider";

// The "describe your own car" fields shared by TradeDetailsModal (signed-in users)
// and QuickSignupModal's first step (signed-out users) - kept as one form instead of
// two copies so the two flows can't drift apart on field list or icebreaker wording.
export default function TradeDetailsForm({
  candidateMake,
  candidateModel,
  submitLabel,
  onCancel,
  onSubmit,
}: {
  candidateMake: string;
  candidateModel: string;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (icebreakerText: string) => void;
}) {
  const { t } = useLocale();
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
          placeholder={t("tradeModal.make")}
          value={make}
          onChange={(e) => setMake(e.target.value)}
          className="field"
        />
        <input
          required
          placeholder={t("tradeModal.model")}
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="field"
        />
        <input
          type="number"
          placeholder={t("tradeModal.year")}
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className="field"
        />
        <input
          type="number"
          placeholder={t("tradeModal.price")}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="field"
        />
      </div>
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
