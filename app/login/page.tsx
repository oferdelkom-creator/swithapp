import { Suspense } from "react";
import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="text-2xl font-semibold mb-2">התחברות</h1>
      <p className="text-neutral-500 mb-8 text-sm">
        אותו טופס גם יוצר חשבון חדש - אם אין לך חשבון, עברו ללשונית &quot;יצירת חשבון&quot;.
      </p>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
