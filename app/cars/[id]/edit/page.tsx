import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import type { Car } from "@/lib/types";
import CarForm from "../../CarForm";

export default async function EditCarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { t } = await getT();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/cars/${id}/edit`);

  const { data: car } = await supabase.from("cars").select("*").eq("id", id).maybeSingle<Car>();
  if (!car || car.user_id !== user.id) notFound();

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-semibold mb-6">{t("cars.editTitle")}</h1>
      <CarForm car={car} />
    </div>
  );
}
