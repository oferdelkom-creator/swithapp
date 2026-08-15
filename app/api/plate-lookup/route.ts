import { NextRequest, NextResponse } from "next/server";
import type { FuelType, VehicleType } from "@/lib/types";

// Israel's open-data vehicle registry (data.gov.il), CKAN datastore_search API.
// Resource IDs are stable dataset identifiers, not secrets - see README for sourcing
// notes. Only "car"/"motorcycle"/"truck" have a matching government registry;
// caravans and jet skis aren't tracked by this API.
const RESOURCE_BY_TYPE: Partial<Record<VehicleType, string>> = {
  car: "053cea08-09bc-40ec-8f7a-156f0677aff3",
  motorcycle: "bf9df4e2-d90d-4c0a-a400-19e15af8e95f",
  truck: "cd3acc5c-03c3-4c89-9c54-d40f93c0d790",
};

const FUEL_TYPE_MAP: Record<string, FuelType> = {
  "בנזין": "Petrol",
  "דיזל": "Diesel",
  "היברידי": "Hybrid",
  "היברידי (חשמל/בנזין)": "Hybrid",
  "חשמלי": "Electric",
  "חשמל": "Electric",
  "גז": "Gas",
  "בנזין/גז": "Gas",
};

interface GovRecord {
  tozeret_nm?: string;
  kinuy_mishari?: string;
  degem_nm?: string;
  shnat_yitzur?: string | number;
  tzeva_rechev?: string;
  sug_delek_nm?: string;
}

export async function GET(req: NextRequest) {
  const plateRaw = req.nextUrl.searchParams.get("plate") ?? "";
  const type = (req.nextUrl.searchParams.get("type") as VehicleType | null) ?? "car";
  const plate = plateRaw.replace(/[^0-9]/g, "");

  if (!plate) {
    return NextResponse.json({ error: "missing_plate" }, { status: 400 });
  }

  const resourceId = RESOURCE_BY_TYPE[type];
  if (!resourceId) {
    return NextResponse.json({ error: "no_registry_for_type" }, { status: 404 });
  }

  const url = new URL("https://data.gov.il/api/3/action/datastore_search");
  url.searchParams.set("resource_id", resourceId);
  url.searchParams.set("filters", JSON.stringify({ mispar_rechev: plate }));
  url.searchParams.set("limit", "1");

  let res: Response;
  try {
    res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
  } catch {
    return NextResponse.json({ error: "upstream_unreachable" }, { status: 502 });
  }

  if (!res.ok) {
    return NextResponse.json({ error: "upstream_error", status: res.status }, { status: 502 });
  }

  const data = await res.json();
  const record: GovRecord | undefined = data?.result?.records?.[0];
  if (!record) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const year = record.shnat_yitzur ? Number(record.shnat_yitzur) : null;
  const fuelType = record.sug_delek_nm ? FUEL_TYPE_MAP[record.sug_delek_nm.trim()] ?? null : null;

  return NextResponse.json({
    make: record.tozeret_nm?.trim() || null,
    model: (record.kinuy_mishari || record.degem_nm)?.trim() || null,
    year: year && year > 1950 && year < 2100 ? year : null,
    color: record.tzeva_rechev?.trim() || null,
    fuel_type: fuelType,
  });
}
