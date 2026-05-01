import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildOriginDeniedResponse } from "../_shared/origin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

console.log("[checkPlantDistribution] Function loaded successfully");

type RegionKey =
  | "EUROPE"
  | "NORTH_AMERICA"
  | "SOUTH_AMERICA"
  | "ASIA"
  | "AFRICA"
  | "OCEANIA"
  | "MEDITERRANEAN"
  | "NEAR_EAST";

type RequestBody = {
  gbifId: number | string;
  regions?: RegionKey[];
};

type RegionResult = {
  key: RegionKey;
  totalCount: number;
  regionCount: number;
  proportion: number;
  hasPresence: boolean;
  countries: { code: string; count: number }[];
};

// ISO 3166-1 alpha-2 country codes per region.
// Regionen dürfen überlappen (z.B. TR in EUROPE und NEAR_EAST).
const REGION_COUNTRIES: Record<RegionKey, Set<string>> = {
  EUROPE: new Set([
    "AL", "AD", "AT", "BY", "BE", "BA", "BG", "HR", "CY", "CZ", "DK",
    "EE", "FI", "FR", "DE", "GR", "HU", "IS", "IE", "IT", "XK", "LV",
    "LI", "LT", "LU", "MT", "MD", "MC", "ME", "NL", "MK", "NO", "PL",
    "PT", "RO", "RU", "SM", "RS", "SK", "SI", "ES", "SE", "CH", "TR",
    "UA", "GB", "UK", "VA",
  ]),
  NORTH_AMERICA: new Set([
    "CA", "US", "MX", "GL", "BM", "BS", "CU", "HT", "DO", "JM", "PR",
    "BZ", "GT", "HN", "SV", "NI", "CR", "PA",
  ]),
  SOUTH_AMERICA: new Set([
    "AR", "BO", "BR", "CL", "CO", "EC", "FK", "GF", "GY", "PE", "PY",
    "SR", "UY", "VE",
  ]),
  ASIA: new Set([
    "AF", "AM", "AZ", "BH", "BD", "BT", "BN", "KH", "CN", "GE", "IN",
    "ID", "IR", "IQ", "IL", "JP", "JO", "KZ", "KW", "KG", "LA", "LB",
    "MY", "MV", "MN", "MM", "NP", "KP", "OM", "PK", "PH", "QA", "SA",
    "SG", "KR", "LK", "PS", "SY", "TJ", "TH", "TL", "TM", "AE", "UZ",
    "VN", "YE", "TR", "RU",
  ]),
  AFRICA: new Set([
    "DZ", "AO", "BJ", "BW", "BF", "BI", "CM", "CV", "CF", "TD", "KM",
    "CG", "CD", "CI", "DJ", "EG", "GQ", "ER", "SZ", "ET", "GA", "GM",
    "GH", "GN", "GW", "KE", "LS", "LR", "LY", "MG", "MW", "ML", "MR",
    "MU", "YT", "MA", "MZ", "NA", "NE", "NG", "RE", "RW", "SH", "ST",
    "SN", "SC", "SL", "SO", "ZA", "SS", "SD", "TZ", "TG", "TN", "UG",
    "EH", "ZM", "ZW",
  ]),
  OCEANIA: new Set([
    "AS", "AU", "CK", "FJ", "PF", "GU", "KI", "MH", "FM", "NR", "NC",
    "NZ", "NU", "MP", "PW", "PG", "PN", "WS", "SB", "TK", "TO", "TV",
    "UM", "VU", "WF",
  ]),
  MEDITERRANEAN: new Set([
    // Süd-Europa + Nordafrika + Levante
    "ES", "FR", "IT", "GR", "CY", "MT", "HR", "SI", "AL", "ME", "BA",
    "TR", "PT", "TN", "DZ", "MA", "LY", "EG", "IL", "LB", "SY",
  ]),
  NEAR_EAST: new Set([
    "TR", "CY", "SY", "LB", "IL", "PS", "JO", "IQ", "IR", "SA", "KW",
    "QA", "BH", "AE", "YE", "OM",
  ]),
};

function normalizeRegionList(regions?: RegionKey[]): RegionKey[] {
  if (!regions || regions.length === 0) {
    return ["EUROPE"]; // Default: nur Europa prüfen
  }
  const unique: RegionKey[] = [];
  for (const r of regions) {
    if (!unique.includes(r)) unique.push(r);
  }
  return unique;
}

async function getAuthenticatedUser(req: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("[checkPlantDistribution] Missing Supabase env vars");
    throw new Error("Supabase not configured");
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: req.headers.get("Authorization") ?? "",
      },
    },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.warn("[checkPlantDistribution] Unauthorized request", authError);
    throw new Error("UNAUTHORIZED");
  }

  return user;
}

async function fetchGbifCountryFacet(gbifId: string | number) {
  const url = new URL("https://api.gbif.org/v1/occurrence/search");
  url.searchParams.set("taxonKey", String(gbifId));
  url.searchParams.set("hasCoordinate", "true");
  url.searchParams.set("limit", "0");
  url.searchParams.set("facet", "country");
  url.searchParams.set("facetLimit", "300");

  console.log("[checkPlantDistribution] Fetching GBIF occurrence facets for taxonKey=", gbifId);

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": "floralog-checkPlantDistribution/1.0",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[checkPlantDistribution] GBIF API error", res.status, text);
    throw new Error(`GBIF API error: ${res.status}`);
  }

  const data = await res.json();
  return data as any;
}

function computeRegionResults(
  gbifData: any,
  regionKeys: RegionKey[],
): RegionResult[] {
  const totalCount: number = typeof gbifData.count === "number" ? gbifData.count : 0;

  const countryFacet = (gbifData.facets || []).find(
    (f: any) => f.field === "COUNTRY" || f.field === "country",
  );

  const countryCounts: Record<string, number> = {};
  if (countryFacet && Array.isArray(countryFacet.counts)) {
    for (const c of countryFacet.counts) {
      if (!c || typeof c.name !== "string") continue;
      const code = c.name.toUpperCase();
      const count = typeof c.count === "number" ? c.count : 0;
      if (!countryCounts[code]) countryCounts[code] = 0;
      countryCounts[code] += count;
    }
  }

  const results: RegionResult[] = [];

  for (const key of regionKeys) {
    const countriesForRegion = REGION_COUNTRIES[key] || new Set<string>();
    let regionCount = 0;
    const regionCountries: { code: string; count: number }[] = [];

    for (const [code, count] of Object.entries(countryCounts)) {
      if (countriesForRegion.has(code)) {
        regionCount += count;
        regionCountries.push({ code, count });
      }
    }

    const proportion = totalCount > 0 ? regionCount / totalCount : 0;
    const hasPresence = regionCount > 0;

    results.push({
      key,
      totalCount,
      regionCount,
      proportion,
      hasPresence,
      countries: regionCountries.sort((a, b) => b.count - a.count),
    });
  }

  return results;
}

Deno.serve(async (req) => {
  console.log("[checkPlantDistribution] === REQUEST RECEIVED ===");
  console.log("[checkPlantDistribution] Method:", req.method);

  if (req.method === "OPTIONS") {
    console.log("[checkPlantDistribution] Handling OPTIONS request");
    return new Response(null, { headers: corsHeaders });
  }

  const originDeniedResponse = buildOriginDeniedResponse(req, corsHeaders, "checkPlantDistribution");
  if (originDeniedResponse) {
    return originDeniedResponse;
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }

  try {
    try {
      await getAuthenticatedUser(req);
    } catch (authError: any) {
      if (authError instanceof Error && authError.message === "UNAUTHORIZED") {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } },
        );
      }
      throw authError;
    }

    const body = (await req.json()) as RequestBody;
    const { gbifId, regions } = body;

    if (!gbifId) {
      return new Response(
        JSON.stringify({ error: "gbifId required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const regionKeys = normalizeRegionList(regions);

    const gbifData = await fetchGbifCountryFacet(gbifId);
    const regionResults = computeRegionResults(gbifData, regionKeys);

    const europeResult = regionResults.find((r) => r.key === "EUROPE");
    const europeThreshold = 0.2; // mindestens 20 % der Funde in Europa
    let isEuropean = false;

    if (europeResult && europeResult.totalCount > 0) {
      isEuropean = europeResult.proportion >= europeThreshold;
    }

    const responsePayload = {
      gbifId: String(gbifId),
      totalCount: europeResult?.totalCount ?? null,
      regions: regionResults,
      // Primärer Shortcut für Floralog heute:
      is_european: isEuropean,
      europe_threshold: europeThreshold,
    };

    return new Response(
      JSON.stringify(responsePayload),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error: any) {
    console.error("[checkPlantDistribution] Unexpected error:", error);
    const message = error?.message ?? String(error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
});
