import { NextRequest, NextResponse } from "next/server";
import type { FuelType, VehicleType } from "@/lib/types";

// Israel's open-data vehicle registry (data.gov.il), CKAN datastore_search API.
// Resource IDs are stable dataset identifiers, not secrets - see README for sourcing
// notes. "bus" uses the public-transport-vehicles resource. Caravans and jet skis
// aren't tracked by this API.
const RESOURCE_BY_TYPE: Partial<Record<VehicleType, string>> = {
  car: "053cea08-09bc-40ec-8f7a-156f0677aff3",
  motorcycle: "bf9df4e2-d90d-4c0a-a400-19e15af8e95f",
  truck: "cd3acc5c-03c3-4c89-9c54-d40f93c0d790",
  bus: "cf29862d-ca25-4691-84f6-1be60dcb4a1e",
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
  mispar_rechev?: string | number;
  tozeret_cd?: string | number;
  tozeret_nm?: string;
  degem_cd?: string | number;
  degem_nm?: string;
  kinuy_mishari?: string;
  ramat_gimur?: string;
  shnat_yitzur?: string | number;
  degem_manoa?: string;
  tzeva_rechev?: string;
  sug_delek_nm?: string;
  baalut?: string;
  moed_aliya_lakvish?: string;
  mivchan_acharon_dt?: string;
  tokef_dt?: string;
  horaat_rishum?: string;
  misgeret?: string;
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
    res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 86400 },
    });
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
    plate,
    source: "ministry_of_transport_open_data",
    make: record.tozeret_nm?.trim() || null,
    make_code: record.tozeret_cd != null ? String(record.tozeret_cd) : null,
    model: (record.kinuy_mishari || record.degem_nm)?.trim() || null,
    model_code: record.degem_cd != null ? String(record.degem_cd) : null,
    trim: record.ramat_gimur?.trim() || null,
    year: year && year > 1950 && year < 2100 ? year : null,
    engine_model: record.degem_manoa?.trim() || null,
    color: record.tzeva_rechev?.trim() || null,
    fuel_type: fuelType,
    fuel_type_raw: record.sug_delek_nm?.trim() || null,
    ownership_raw: record.baalut?.trim() || null,
    first_registration_date: record.moed_aliya_lakvish || null,
    last_test_date: record.mivchan_acharon_dt || null,
    license_valid_until: record.tokef_dt || null,
    registration_directive: record.horaat_rishum?.trim() || null,
    chassis_number: record.misgeret?.trim() || null,
  });
}