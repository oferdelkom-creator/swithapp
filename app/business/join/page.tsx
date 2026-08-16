import { Suspense } from "react";
import DealerJoinForm from "./DealerJoinForm";

export default function DealerJoinPage() {
  return (
    <Suspense fallback={null}>
      <DealerJoinForm />
    </Suspense>
  );
}
