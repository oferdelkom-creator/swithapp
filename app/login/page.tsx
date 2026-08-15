import { Suspense } from "react";
import LoginForm from "./LoginForm";
import { getT } from "@/lib/i18n/server";

export default async function LoginPage() {
  const { t } = await getT();
  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="text-2xl font-semibold mb-2">{t("login.title")}</h1>
      <p className="text-neutral-500 mb-8 text-sm">{t("login.subtitle")}</p>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
