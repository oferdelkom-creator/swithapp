import { Suspense } from "react";
import BusinessLoginForm from "./BusinessLoginForm";

export default function BusinessLoginPage() {
  return (
    <Suspense fallback={null}>
      <BusinessLoginForm />
    </Suspense>
  );
}

