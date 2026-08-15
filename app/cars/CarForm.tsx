"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/LocaleProvider";
import { regionLabel, fuelTypeLabel } from "@/lib/i18n/enumLabels";
import type { Car, CarRegion, FuelType } from "@/lib/types";

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

export default function CarForm({ car }: { car?: Car }) {
  const router = useRouter();
  const { t, locale } = useLocale();
  const isEdit = !!car;
  const [make, setMake] = useState(car?.make ?? "");
  const [model, setModel] = useState(car?.model ?? "");
  const [year, setYear] = useState(car?.year?.toString() ?? "");
  const [price, setPrice] = useState(car?.price?.toString() ?? "");
  const [mileage, setMileage] = useState(car?.mileage?.toString() ?? "");
  const [transmission, setTransmission] = useState(car?.transmission ?? "Automatic");
  const [region, setRegion] = useState<CarRegion | "">(car?.region ?? "");
  const [fuelType, setFuelType] = useState<FuelType | "">(car?.fuel_type ?? "");
  const [forSale, setForSale] = useState(car?.for_sale ?? true);
  const [forSwap, setForSwap] = useState(car?.for_swap ?? true);
  const [wantMake, setWantMake] = useState(car?.want_make ?? "");
  const [wantModel, setWantModel] = useState(car?.want_model ?? "");
  const [photoUrls, setPhotoUrls] = useState<string[]>(car?.photo_urls ?? []);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError(t("login.mustSignIn"));
      setUploading(false);
      return;
    }

    const newUrls: string[] = [];
    for (const file of Array.from(files)) {
      const path = `${user.id}/${crypto.randomUUID()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from("car-photos").upload(path, file);
      if (uploadError) {
        setError(uploadError.message);
        continue;
      }
      const { data } = supabase.storage.from("car-photos").getPublicUrl(path);
      newUrls.push(data.publicUrl);
    }
    setPhotoUrls((prev) => [...prev, ...newUrls]);
    setUploading(false);
    e.target.value = "";
  }

  function removePhoto(url: string) {
    setPhotoUrls((prev) => prev.filter((u) => u !== url));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError(t("login.mustSignIn"));
      setLoading(false);
      return;
    }

    const payload = {
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
      photo_urls: photoUrls,
    };

    const { error: saveError } = isEdit
      ? await supabase.from("cars").update(payload).eq("id", car!.id)
      : await supabase.from("cars").insert({ ...payload, user_id: user.id });

    if (saveError) {
      setError(saveError.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    if (isEdit) {
      router.push("/cars");
    } else {
      setMake("");
      setModel("");
      setYear("");
      setPrice("");
      setMileage("");
      setWantMake("");
      setWantModel("");
      setPhotoUrls([]);
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4 p-5">
      <div>
        <label className="block text-sm font-medium mb-1">{t("carForm.photos")}</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {photoUrls.map((url) => (
            <div key={url} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="w-20 h-20 object-cover rounded-lg" />
              <button
                type="button"
                onClick={() => removePhoto(url)}
                className="absolute -top-1 -end-1 bg-red-700 text-white rounded-full w-5 h-5 text-xs leading-5"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <input type="file" accept="image/*" multiple onChange={handlePhotoSelect} disabled={uploading} />
        {uploading && <p className="text-xs text-muted mt-1">{t("carForm.uploading")}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">{t("carForm.make")}</label>
          <input required value={make} onChange={(e) => setMake(e.target.value)} className="field" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t("carForm.model")}</label>
          <input required value={model} onChange={(e) => setModel(e.target.value)} className="field" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t("carForm.year")}</label>
          <input type="number" value={year} onChange={(e) => setYear(e.target.value)} className="field" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t("carForm.mileage")}</label>
          <input
            type="number"
            value={mileage}
            onChange={(e) => setMileage(e.target.value)}
            className="field"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t("carForm.transmission")}</label>
          <select
            value={transmission}
            onChange={(e) => setTransmission(e.target.value)}
            className="field"
          >
            <option value="Automatic">{t("carForm.automatic")}</option>
            <option value="Manual">{t("carForm.manual")}</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t("carForm.fuelType")}</label>
          <select
            value={fuelType}
            onChange={(e) => setFuelType(e.target.value as FuelType)}
            className="field"
          >
            <option value="">-</option>
            {FUEL_TYPES.map((f) => (
              <option key={f} value={f}>
                {fuelTypeLabel(f, locale)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t("carForm.region")}</label>
          <select value={region} onChange={(e) => setRegion(e.target.value as CarRegion)} className="field">
            <option value="">-</option>
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {regionLabel(r, locale)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t("carForm.price")}</label>
          <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="field" />
        </div>
      </div>

      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={forSale} onChange={(e) => setForSale(e.target.checked)} />
          {t("carForm.forSale")}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={forSwap} onChange={(e) => setForSwap(e.target.checked)} />
          {t("carForm.forSwap")}
        </label>
      </div>

      {forSwap && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t("carForm.wantMake")}</label>
            <input value={wantMake} onChange={(e) => setWantMake(e.target.value)} className="field" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("carForm.wantModel")}</label>
            <input value={wantModel} onChange={(e) => setWantModel(e.target.value)} className="field" />
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="submit" disabled={loading || uploading} className="btn-primary">
        {loading ? t("carForm.saving") : isEdit ? t("carForm.saveChanges") : t("carForm.addListing")}
      </button>
    </form>
  );
}
