import { Suspense } from "react";
import DealerJoinForm from "../DealerJoinForm";

export default async function DealerSignupPage() {
  return (
    <Suspense fallback={null}>
      <DealerJoinForm remainingTrialSlots={0} />
    </Suspense>
  );
}
