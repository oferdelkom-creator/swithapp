"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/LocaleProvider";
import { regionLabel, fuelTypeLabel } from "@/lib/i18n/enumLabels";
import { VEHICLE_TYPES, OTHER, getMakes, getModels } from "@/lib/vehicleData";
import { safeExtension } from "@/lib/storage";
import type { Car, CarRegion, FuelType, VehicleType } from "@/lib/types";

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
// Israel's vehicle registry only tracks cars/motorcycles/trucks - caravans and jet
// skis aren't registered there, so plate lookup has nothing to query for them.
const RESOURCE_BACKED_TYPES: VehicleType[] = ["car", "motorcycle", "truck", "bus"];

export default function CarForm({ car }: { car?: Car }) {
  const router = useRouter();
  const { t, locale } = useLocale();
  const isEdit = !!car;
  const [vehicleType, setVehicleType] = useState<VehicleType>(car?.category ?? "car");
  const [plate, setPlate] = useState(car?.plate_number ?? "");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);

  const initialMakeInList = car ? getMakes(car.category).includes(car.make) : true;
  const initialModelInList = car ? getModels(car.category, car.make).includes(car.model) : true;
  const [make, setMake] = useState(initialMakeInList ? car?.make ?? "" : OTHER);
  const [makeOther, setMakeOther] = useState(initialMakeInList ? "" : car?.make ?? "");
  const [model, setModel] = useState(initialModelInList ? car?.model ?? "" : OTHER);
  const [modelOther, setModelOther] = useState(initialModelInList ? "" : car?.model ?? "");
  const [year, setYear] = useState(car?.year?.toString() ?? "");
  const [color, setColor] = useState(car?.color ?? "");
  const [price, setPrice] = useState(car?.price?.toString() ?? "");
  const [hand, setHand] = useState(car?.hand?.toString() ?? "");
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

  const makeOptions = getMakes(vehicleType);
  const modelOptions = getModels(vehicleType, make);

  function handleVehicleTypeChange(next: VehicleType) {
    setVehicleType(next);
    setMake("");
    setMakeOther("");
    setModel("");
    setModelOther("");
  }

  function handleMakeChange(next: string) {
    setMake(next);
    setModel("");
    setModelOther("");
  }

  async function lookupPlate() {
    setLookupMessage(null);
    if (!RESOURCE_BACKED_TYPES.includes(vehicleType)) {
      setLookupMessage(t("carForm.lookupPlateUnavailable"));
      return;
    }
    if (!plate.trim()) return;
    setLookupLoading(true);
    try {
      const res = await fetch(`/api/plate-lookup?plate=${encodeURIComponent(plate)}&type=${vehicleType}`);
      if (res.status === 404) {
        setLookupMessage(t("carForm.lookupPlateNotFound"));
        return;
      }
      if (!res.ok) {
        setLookupMessage(t("carForm.lookupPlateError"));
        return;
      }
      const data = await res.json();
      if (data.make) {
        const inList = makeOptions.includes(data.make);
        setMake(inList ? data.make : OTHER);
        setMakeOther(inList ? "" : data.make);
      }
      if (data.model) {
        const modelsForMake = getModels(vehicleType, data.make ?? make);
        const inList = modelsForMake.includes(data.model);
        setModel(inList ? data.model : OTHER);
        setModelOther(inList ? "" : data.model);
      }
      if (data.year) setYear(String(data.year));
      if (data.color) setColor(data.color);
      if (data.fuel_type) setFuelType(data.fuel_type);
      setLookupMessage(t("carForm.lookupPlateSuccess"));
    } catch {
      setLookupMessage(t("carForm.lookupPlateError"));
    } finally {
      setLookupLoading(false);
    }
  }

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError(t("login.mustSignIn"));
        return;
      }

      const newUrls: string[] = [];
      const errors: string[] = [];
      for (const file of Array.from(files)) {
        const path = `${user.id}/${crypto.randomUUID()}${safeExtension(file.name)}`;
        const { error: uploadError } = await supabase.storage.from("car-photos").upload(path, file);
        if (uploadError) {
          errors.push(uploadError.message);
          continue;
        }
        const { data } = supabase.storage.from("car-photos").getPublicUrl(path);
        newUrls.push(data.publicUrl);
      }
      if (errors.length) setError(errors.join(" / "));
      setPhotoUrls((prev) => [...prev, ...newUrls]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("login.genericError"));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
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

    const resolvedMake = make === OTHER ? makeOther.trim() : make;
    const resolvedModel = model === OTHER ? modelOther.trim() : model;
    if (!resolvedMake || !resolvedModel) {
      setError(t("carForm.make") + " / " + t("carForm.model"));
      setLoading(false);
      return;
    }

    const payload = {
      category: vehicleType,
      make: resolvedMake,
      model: resolvedModel,
      year: year ? Number(year) : null,
      color: color || null,
      plate_number: plate.trim() || null,
      price: price ? Number(price) : null,
      hand: hand ? Number(hand) : null,
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
      setMakeOther("");
      setModel("");
      setModelOther("");
      setYear("");
      setColor("");
      setPlate("");
      setPrice("");
      setHand("");
      setMileage("");
      setWantMake("");
      setWantModel("");
      setPhotoUrls([]);
    }
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[20px] overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.08)] bg-white m-4"
    >
      <div className="relative w-full aspect-video bg-neutral-100">
        {photoUrls[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrls[0]} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <label className="absolute inset-0 flex flex-col items-center justify-center gap-2 cursor-pointer text-neutral-400 hover:bg-neutral-200/60 transition-colors">
            <CameraIcon />
            <span className="text-sm font-medium">
              {uploading ? t("carForm.uploading") : t("carForm.addPhotos")}
            </span>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoSelect}
              disabled={uploading}
              className="hidden"
            />
          </label>
        )}
        {photoUrls.length > 0 && (
          <label className="absolute bottom-3 end-3 rounded-full bg-white/90 backdrop-blur px-4 py-1.5 text-sm font-medium cursor-pointer hover:bg-white transition-colors">
            {uploading ? t("carForm.uploading") : t("carForm.addPhotos")}
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoSelect}
              disabled={uploading}
              className="hidden"
            />
          </label>
        )}
      </div>

      {photoUrls.length > 0 && (
        <div className="flex gap-2 px-5 pt-3 overflow-x-auto no-scrollbar">
          {photoUrls.map((url) => (
            <div key={url} className="relative shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="w-16 h-16 object-cover rounded-lg" />
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
      )}

      <div className="p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">{t("carForm.vehicleType")}</label>
          <div className="flex flex-wrap gap-2">
            {VEHICLE_TYPES.map((vt) => (
              <button
                key={vt.value}
                type="button"
                onClick={() => handleVehicleTypeChange(vt.value)}
                className={vehicleType === vt.value ? "chip-active px-4 py-1.5 text-sm" : "chip-inactive px-4 py-1.5 text-sm"}
              >
                {t(vt.labelKey)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{t("carForm.plateNumber")}</label>
          <div className="flex gap-2">
            <input
              value={plate}
              onChange={(e) => setPlate(e.target.value)}
              placeholder={t("carForm.plateNumberPlaceholder")}
              className="field flex-1"
            />
            <button
              type="button"
              onClick={lookupPlate}
              disabled={lookupLoading || !plate.trim()}
              className="btn-secondary whitespace-nowrap"
            >
              {lookupLoading ? t("carForm.lookupPlateLoading") : t("carForm.lookupPlate")}
            </button>
          </div>
          {lookupMessage && <p className="text-xs text-muted mt-1">{lookupMessage}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t("carForm.make")}</label>
            <select required value={make} onChange={(e) => handleMakeChange(e.target.value)} className="field">
              <option value="" disabled>
                -
              </option>
              {makeOptions.map((m) => (
                <option key={m} value={m}>
                  {m === OTHER ? t("carForm.makeOther") : m}
                </option>
              ))}
            </select>
            {make === OTHER && (
              <input
                required
                value={makeOther}
                onChange={(e) => setMakeOther(e.target.value)}
                className="field mt-2"
                placeholder={t("carForm.make")}
              />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("carForm.model")}</label>
            <select required value={model} onChange={(e) => setModel(e.target.value)} className="field">
              <option value="" disabled>
                -
              </option>
              {modelOptions.map((m) => (
                <option key={m} value={m}>
                  {m === OTHER ? t("carForm.modelOther") : m}
                </option>
              ))}
            </select>
            {model === OTHER && (
              <input
                required
                value={modelOther}
                onChange={(e) => setModelOther(e.target.value)}
                className="field mt-2"
                placeholder={t("carForm.model")}
              />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("carForm.year")}</label>
            <input type="number" value={year} onChange={(e) => setYear(e.target.value)} className="field" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("carForm.color")}</label>
            <input value={color} onChange={(e) => setColor(e.target.value)} className="field" />
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
            <input required type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="field" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("carForm.hand")}</label>
            <input type="number" min="0" value={hand} onChange={(e) => setHand(e.target.value)} className="field" />
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
      </div>
    </form>
  );
}

function CameraIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path
        d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1-2h7l1 2h2A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5v-9z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12.5" r="3.5" />
    </svg>
  );
}
