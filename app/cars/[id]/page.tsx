import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Car } from "@/lib/types";
import CarDetail from "./CarDetail";

export default async function CarDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/cars/${id}`);

  const { data: car } = await supabase.from("cars").select("*").eq("id", id).maybeSingle<Car>();
  if (!car) notFound();

  const { data: seller } = await supabase
    .from("users")
    .select("name")
    .eq("id", car.user_id)
    .maybeSingle<{ name: string }>();

  return <CarDetail car={car} sellerName={seller?.name ?? ""} />;
}
