"use client";

import { useLocale } from "@/components/LocaleProvider";
import TradeDetailsForm from "@/components/TradeDetailsForm";

// Thin overlay wrapper around TradeDetailsForm for an already signed-in visitor -
// the swipe fires as soon as they submit. A signed-out visitor gets the same form
// as the first step of QuickSignupModal instead, followed by phone/OTP.
export default function TradeDetailsModal({
  candidateMake,
  candidateModel,
  candidatePrice,
  onCancel,
  onSubmit,
}: {
  candidateMake: string;
  candidateModel: string;
  candidatePrice: number | null;
  onCancel: () => void;
  onSubmit: (icebreakerText: string) => void;
}) {
  const { t } = useLocale();
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-4 pb-4 sm:pb-0">
      <div className="card p-6 w-full max-w-sm text-sm">
        <TradeDetailsForm
          candidateMake={candidateMake}
          candidateModel={candidateModel}
          candidatePrice={candidatePrice}
          submitLabel={t("tradeModal.send")}
          onCancel={onCancel}
          onSubmit={onSubmit}
        />
      </div>
    </div>
  );
}
