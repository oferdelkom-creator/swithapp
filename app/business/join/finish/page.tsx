import { Suspense } from "react";
import FinishSignup from "./FinishSignup";

export default function FinishSignupPage() {
  return (
    <Suspense fallback={null}>
      <FinishSignup />
    </Suspense>
  );
}
