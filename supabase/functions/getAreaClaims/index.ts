import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import proj4 from "https://esm.sh/proj4@2.15.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const AREA_SIZE_M = 100;
const EPSG_3035 = "+proj=laea +lat_0=52 +lon_0=10 +x_0=4321000 +y_0=3210000 +datum=ETRS89 +units=m +no_defs +type=crs";
proj4.defs("EPSG:3035", EPSG_3035);

type RequestBody = {
  authId?: string;
  latitude?: number;
  longitude?: number;
  radiusM?: number;
};

type AreaClaimRow = {
  area_x: number;
  area_y: number;
  owner_auth_id: string;
  owner_scan_count: number;
  claim_group_name: string | null;
  claimed_at: string;
  updated_at: string;
};

type PublicProfileRow = {
  auth_id: string;
  display_name: string | null;
  full_name: string | null;
  user_email: string | null;
  selected_border_color: string | null;
};

function deriveOwnerName(profile: PublicProfileRow | null): string | null {
  if (!profile) return null;

  const displayName = String(profile.display_name || "").trim();
  if (displayName) return displayName;

  const fullName = String(profile.full_name || "").trim();
  if (fullName) return fullName;

  const email = String(profile.user_email || "").trim().toLowerCase();
  if (email && email.includes("@")) {
    return email.split("@")[0];
  }

  return null;
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function isUuid(value: string | null | undefined): value is string {
  return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function lngLatToMetric(lng: number, lat: number): { x: number; y: number } {
  const [x, y] = proj4("EPSG:4326", "EPSG:3035", [lng, lat]);
  return { x: Number(x), y: Number(y) };
}

function metricToLngLat(x: number, y: number): { lat: number; lng: number } {
  const [lng, lat] = proj4("EPSG:3035", "EPSG:4326", [x, y]);
  return { lat: Number(lat), lng: Number(lng) };
}

function getAreaCenter(areaX: number, areaY: number): { lat: number; lng: number } {
  const centerX = (areaX + 0.5) * AREA_SIZE_M;
  const centerY = (areaY + 0.5) * AREA_SIZE_M;
  return metricToLngLat(centerX, centerY);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Supabase service not configured" }, 500);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const body = (await req.json()) as RequestBody;
    const authId = String(body.authId || "").trim();
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    const radiusM = Math.max(100, Math.min(5000, Number(body.radiusM ?? 1500)));

    if (!isUuid(authId)) {
      return jsonResponse({ error: "authId is required" }, 400);
    }

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return jsonResponse({ error: "latitude and longitude are required" }, 400);
    }

    const { x: centerX, y: centerY } = lngLatToMetric(longitude, latitude);
    const minAreaX = Math.floor((centerX - radiusM) / AREA_SIZE_M);
    const maxAreaX = Math.floor((centerX + radiusM) / AREA_SIZE_M);
    const minAreaY = Math.floor((centerY - radiusM) / AREA_SIZE_M);
    const maxAreaY = Math.floor((centerY + radiusM) / AREA_SIZE_M);

    const { data: claims, error: claimError } = await adminClient
      .from("AreaClaim")
      .select("area_x, area_y, owner_auth_id, owner_scan_count, claim_group_name, claimed_at, updated_at")
      .gte("area_x", minAreaX)
      .lte("area_x", maxAreaX)
      .gte("area_y", minAreaY)
      .lte("area_y", maxAreaY)
      .order("area_x", { ascending: true })
      .order("area_y", { ascending: true });

    if (claimError) {
      console.error("[getAreaClaims] claim query failed", claimError);
      return jsonResponse({ error: "Failed to load claims" }, 500);
    }

    const filteredClaims = (claims || []).filter((claim: AreaClaimRow) => {
      const areaCenterX = (claim.area_x + 0.5) * AREA_SIZE_M;
      const areaCenterY = (claim.area_y + 0.5) * AREA_SIZE_M;
      const dx = areaCenterX - centerX;
      const dy = areaCenterY - centerY;
      return dx * dx + dy * dy <= radiusM * radiusM;
    });

    const ownerIds = Array.from(new Set(filteredClaims.map((claim: AreaClaimRow) => claim.owner_auth_id))).filter(isUuid);
    let ownerProfiles: PublicProfileRow[] = [];

    if (ownerIds.length > 0) {
      const { data: profileRows, error: profileError } = await adminClient
        .from("PublicProfile")
        .select("auth_id, display_name, full_name, user_email, selected_border_color")
        .in("auth_id", ownerIds);

      if (profileError) {
        console.warn("[getAreaClaims] profile query failed", profileError);
      } else {
        ownerProfiles = (profileRows || []) as PublicProfileRow[];
      }
    }

    const profileByAuth = new Map(ownerProfiles.map((profile) => [profile.auth_id, profile]));

    const responseClaims = filteredClaims.map((claim: AreaClaimRow) => {
      const center = getAreaCenter(claim.area_x, claim.area_y);
      const ownerProfile = profileByAuth.get(claim.owner_auth_id) || null;
      const ownerName = deriveOwnerName(ownerProfile);
      return {
        areaX: claim.area_x,
        areaY: claim.area_y,
        centerLat: center.lat,
        centerLng: center.lng,
        ownerAuthId: claim.owner_auth_id,
        ownerScanCount: Number(claim.owner_scan_count || 0),
        claimGroupName: claim.claim_group_name ? String(claim.claim_group_name).trim() : null,
        ownerName,
        ownerBorderColor: ownerProfile?.selected_border_color || null,
        claimedAt: claim.claimed_at,
        updatedAt: claim.updated_at,
      };
    });

    return jsonResponse({
      success: true,
      claims: responseClaims,
      radiusM,
    });
  } catch (error) {
    console.error("[getAreaClaims] unexpected error", error);
    return jsonResponse({ error: "Unexpected error" }, 500);
  }
});
