"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { CarRegion, FuelType } from "@/lib/types";

const REGIONS: CarRegion[] = [
  "North",
  "Haifa",
  "Center",
  "Tel Aviv",
  "Jerusalem",
  "Shfela",
  "South",
  "Judea and Samaria",
];
const FUEL_TYPES: FuelType[] = ["Petrol", "Diesel", "Hybrid", "Electric", "Gas"];

export default function CarForm() {
  const router = useRouter();
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [price, setPrice] = useState("");
  const [mileage, setMileage] = useState("");
  const [transmission, setTransmission] = useState("Automatic");
  const [region, setRegion] = useState<CarRegion | "">("");
  const [fuelType, setFuelType] = useState<FuelType | "">("");
  const [forSale, setForSale] = useState(true);
  const [forSwap, setForSwap] = useState(true);
  const [wantMake, setWantMake] = useState("");
  const [wantModel, setWantModel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("יש להתחבר קודם");
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase.from("cars").insert({
      user_id: user.id,
      make,
      model,
      year: year ? Number(year) : null,
      price: price ? Number(price) : null,
      mileage: mileage ? Number(mileage) : null,
      transmission,
      region: region || null,
      fuel_type: fuelType || null,
      for_sale: forSale,
      for_swap: forSwap,
      want_make: forSwap ? wantMake || null : null,
      want_model: forSwap ? wantModel || null : null,
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    setMake("");
    setModel("");
    setYear("");
    setPrice("");
    setMileage("");
    setWantMake("");
    setWantModel("");
    setLoading(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4 p-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">יצרן</label>
          <input
            required
            value={make}
            onChange={(e) => setMake(e.target.value)}
            className="field"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">דגם</label>
          <input
            required
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="field"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">שנה</label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="field"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">ק&quot;מ</label>
          <input
            type="number"
            value={mileage}
            onChange={(e) => setMileage(e.target.value)}
            className="field"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">תמסורת</label>
          <select
            value={transmission}
            onChange={(e) => setTransmission(e.target.value)}
            className="field"
          >
            <option value="Automatic">אוטומט</option>
            <option value="Manual">ידני</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">סוג דלק</label>
          <select
            value={fuelType}
            onChange={(e) => setFuelType(e.target.value as FuelType)}
            className="field"
          >
            <option value="">-</option>
            {FUEL_TYPES.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">אזור</label>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value as CarRegion)}
            className="field"
          >
            <option value="">-</option>
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">מחיר (₪)</label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="field"
          />
        </div>
      </div>

      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={forSale} onChange={(e) => setForSale(e.target.checked)} />
          למכירה
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={forSwap} onChange={(e) => setForSwap(e.target.checked)} />
          להחלפה
        </label>
      </div>

      {forSwap && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">מחפש יצרן (להחלפה)</label>
            <input
              value={wantMake}
              onChange={(e) => setWantMake(e.target.value)}
              className="field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">מחפש דגם</label>
            <input
              value={wantModel}
              onChange={(e) => setWantModel(e.target.value)}
              className="field"
            />
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? "מוסיף..." : "הוספת מודעה"}
      </button>
    </form>
  );
}
