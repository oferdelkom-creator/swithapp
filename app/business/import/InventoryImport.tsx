"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/LocaleProvider";
import type { CarRegion, FuelType, VehicleType } from "@/lib/types";

const REQUIRED_COLUMNS = ["make", "model"] as const;
const VEHICLE_TYPES = new Set<VehicleType>(["car", "motorcycle", "scooter", "truck", "bus", "caravan", "jet_ski", "atv", "boat"]);
const FUEL_TYPES = new Set<FuelType>(["Petrol", "Diesel", "Hybrid", "Electric", "Gas"]);
const REGIONS = new Set<CarRegion>(["North", "Haifa", "Center", "Tel Aviv", "Jerusalem", "Shfela", "South", "Judea and Samaria"]);

type PreviewRow = Record<string, string> & { rowNumber: string; errors: string };

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(value.trim());
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(value.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      value = "";
    } else value += char;
  }
  row.push(value.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function booleanValue(value: string, fallback: boolean): boolean {
  if (!value) return fallback;
  return ["true", "1", "yes", "כן"].includes(value.toLowerCase());
}

function isNonNegativeNumber(value: string): boolean {
  return !value || (Number.isFinite(Number(value)) && Number(value) >= 0);
}

function isNonNegativeInteger(value: string): boolean {
  return !value || (Number.isInteger(Number(value)) && Number(value) >= 0);
}

export default function InventoryImport({ userId }: { userId: string }) {
  const { t } = useLocale();
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function readFile(file: File) {
    setMessage(null);
    setFileName(file.name);
    const parsed = parseCsv(await file.text());
    if (parsed.length < 2) {
      setRows([]);
      setMessage(t("inventoryImport.emptyFile"));
      return;
    }
    const headers = parsed[0].map((header) => header.trim().toLowerCase());
    const missing = REQUIRED_COLUMNS.filter((column) => !headers.includes(column));
    if (missing.length) {
      setRows([]);
      setMessage(t("inventoryImport.missingColumns", { columns: missing.join(", ") }));
      return;
    }

    setRows(
      parsed.slice(1).map((values, index) => {
        const record = Object.fromEntries(headers.map((header, column) => [header, values[column] ?? ""]));
        const errors: string[] = [];
        if (!record.make) errors.push("make");
        if (!record.model) errors.push("model");
        if (record.category && !VEHICLE_TYPES.has(record.category as VehicleType)) errors.push("category");
        if (record.fuel_type && !FUEL_TYPES.has(record.fuel_type as FuelType)) errors.push("fuel_type");
        if (record.region && !REGIONS.has(record.region as CarRegion)) errors.push("region");
        if (record.year && (!Number.isInteger(Number(record.year)) || Number(record.year) < 1900)) errors.push("year");
        if (!isNonNegativeInteger(record.mileage)) errors.push("mileage");
        if (!isNonNegativeNumber(record.price)) errors.push("price");
        if (!isNonNegativeInteger(record.hand)) errors.push("hand");
        return { ...record, rowNumber: String(index + 2), errors: errors.join(", ") };
      })
    );
  }

  async function importRows() {
    const validRows = rows.filter((row) => !row.errors);
    if (!validRows.length) return;
    setLoading(true);
    setMessage(null);
    const payload = validRows.map((row) => ({
      user_id: userId,
      make: row.make,
      model: row.model,
      year: row.year ? Number(row.year) : null,
      mileage: row.mileage ? Number(row.mileage) : null,
      transmission: row.transmission || "Automatic",
      category: (row.category || "car") as VehicleType,
      color: row.color || null,
      plate_number: row.plate_number || null,
      description: row.description || null,
      price: row.price ? Number(row.price) : null,
      hand: row.hand ? Number(row.hand) : null,
      fuel_type: (row.fuel_type || null) as FuelType | null,
      region: (row.region || null) as CarRegion | null,
      for_sale: booleanValue(row.for_sale, true),
      for_swap: booleanValue(row.for_swap, true),
      want_make: row.want_make || null,
      want_model: row.want_model || null,
      photo_urls: row.photo_urls ? row.photo_urls.split("|").map((url) => url.trim()).filter(Boolean).slice(0, 6) : [],
    }));
    const supabase = createClient();
    const { error } = await supabase.from("cars").insert(payload);
    setLoading(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage(t("inventoryImport.success", { count: payload.length }));
    setRows([]);
  }

  const invalidCount = rows.filter((row) => row.errors).length;
  return (
    <div className="mt-8 space-y-6">
      <div className="card space-y-4 p-6">
        <div className="flex flex-wrap gap-3">
          <a href="/templates/switchapp-inventory-template.csv" download className="btn-secondary">
            {t("inventoryImport.downloadTemplate")}
          </a>
          <label className="btn-primary cursor-pointer">
            {t("inventoryImport.chooseFile")}
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => event.target.files?.[0] && readFile(event.target.files[0])} />
          </label>
        </div>
        <p className="text-xs text-muted">{t("inventoryImport.csvHint")}</p>
        {fileName && <p className="text-sm">{fileName}</p>}
        {message && <p className="rounded-lg bg-neutral-100 p-3 text-sm">{message}</p>}
      </div>

      {rows.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm">{t("inventoryImport.previewSummary", { count: rows.length, invalid: invalidCount })}</p>
            <button onClick={importRows} disabled={loading || rows.length === invalidCount} className="btn-primary">
              {loading ? t("inventoryImport.importing") : t("inventoryImport.importValid")}
            </button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="bg-neutral-50 text-start"><tr><th className="p-3">#</th><th className="p-3">Make</th><th className="p-3">Model</th><th className="p-3">Year</th><th className="p-3">Price</th><th className="p-3">{t("inventoryImport.status")}</th></tr></thead>
              <tbody>{rows.map((row) => <tr key={row.rowNumber} className="border-t border-neutral-100"><td className="p-3">{row.rowNumber}</td><td className="p-3">{row.make}</td><td className="p-3">{row.model}</td><td className="p-3">{row.year}</td><td className="p-3">{row.price}</td><td className={`p-3 ${row.errors ? "text-red-600" : "text-emerald-700"}`}>{row.errors || t("inventoryImport.valid")}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      )}
      <Link href="/business" className="text-sm text-brand-blue">{t("inventoryImport.back")}</Link>
    </div>
  );
}
