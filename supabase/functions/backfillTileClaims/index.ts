import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import proj4 from "https://esm.sh/proj4@2.15.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TILE_SIZE_M = 100;
const CLAIM_THRESHOLD = 3;
const SOMMER_2026_CUTOFF = "2026-06-21T00:00:00.000Z";
const EPSG_3035 = "+proj=laea +lat_0=52 +lon_0=10 +x_0=4321000 +y_0=3210000 +datum=ETRS89 +units=m +no_defs +type=crs";

proj4.defs("EPSG:3035", EPSG_3035);

type DiscoveryRow = {
  auth_id: string;
  discovery_location: string;
};

type TileClaimRow = {
  tile_x: number;
  tile_y: number;
  owner_auth_id: string;
  owner_scan_count: number;
  claim_group_name: string | null;
  claimed_at: string;
  updated_at: string;
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function isUuid(value: string | null | undefined): value is string {
  return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function parseDiscoveryLocation(location: string | null | undefined): { lat: number; lng: number } | null {
  if (!location) return null;
  const parts = location.split(",").map((p) => Number(p.trim()));
  if (parts.length < 2) return null;
  const [lat, lng] = parts;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function getTileFromLatLng(lat: number, lng: number): { tileX: number; tileY: number } {
  const [x, y] = proj4("EPSG:4326", "EPSG:3035", [lng, lat]);
  return {
    tileX: Math.floor(Number(x) / TILE_SIZE_M),
    tileY: Math.floor(Number(y) / TILE_SIZE_M),
  };
}

function tileKey(tileX: number, tileY: number): string {
  return `${tileX}:${tileY}`;
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
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");
    const backfillSecret = Deno.env.get("BACKFILL_SECRET");

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Supabase service not configured" }, 500);
    }

    // Simple secret guard: caller must pass the BACKFILL_SECRET (or it's unset = open)
    if (backfillSecret) {
      const body = await req.json().catch(() => ({})) as { secret?: string; dryRun?: boolean };
      if (body.secret !== backfillSecret) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }
      // Re-use parsed body below via closure
      req = new Request(req.url, {
        method: req.method,
        headers: req.headers,
        body: JSON.stringify(body),
      });
    }

    const body = await req.json().catch(() => ({})) as { dryRun?: boolean };
    const dryRun = body.dryRun === true;

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    console.log("[backfillTileClaims] Loading discoveries since", SOMMER_2026_CUTOFF);

    // 1) Load all discoveries since the summer 2026 season cutoff
    const { data: discoveries, error: discoveriesError } = await adminClient
      .from("UserPlantDiscovery")
      .select("auth_id, discovery_location")
      .not("discovery_location", "is", null)
      .not("auth_id", "is", null)
      .gte("discovered_date", SOMMER_2026_CUTOFF)
      .limit(50000);

    if (discoveriesError) {
      console.error("[backfillTileClaims] Failed to load discoveries", discoveriesError);
      return jsonResponse({ error: "Failed to load discoveries" }, 500);
    }

    console.log("[backfillTileClaims] Loaded", discoveries?.length ?? 0, "discoveries");

    // 2) Aggregate scan counts per (tile, auth)
    // scanCountByTile: tileKey → Map<authId, count>
    const scanCountByTile = new Map<string, Map<string, number>>();

    for (const row of (discoveries || []) as DiscoveryRow[]) {
      const coords = parseDiscoveryLocation(row.discovery_location);
      if (!coords) continue;
      const rowAuthId = String(row.auth_id || "").trim();
      if (!isUuid(rowAuthId)) continue;

      const { tileX, tileY } = getTileFromLatLng(coords.lat, coords.lng);
      const key = tileKey(tileX, tileY);

      if (!scanCountByTile.has(key)) {
        scanCountByTile.set(key, new Map());
      }
      const authMap = scanCountByTile.get(key)!;
      authMap.set(rowAuthId, (authMap.get(rowAuthId) || 0) + 1);
    }

    console.log("[backfillTileClaims] Aggregated", scanCountByTile.size, "distinct tiles");

    // 3) Load existing TileClaims
    const { data: existingClaims, error: existingError } = await adminClient
      .from("TileClaim")
      .select("tile_x, tile_y, owner_auth_id, owner_scan_count, claim_group_name, claimed_at, updated_at")
      .limit(100000);

    if (existingError) {
      console.error("[backfillTileClaims] Failed to load existing TileClaims", existingError);
      return jsonResponse({ error: "Failed to load existing claims" }, 500);
    }

    const existingByKey = new Map<string, TileClaimRow>();
    for (const claim of (existingClaims || []) as TileClaimRow[]) {
      existingByKey.set(tileKey(claim.tile_x, claim.tile_y), claim);
    }

    console.log("[backfillTileClaims] Existing claims:", existingByKey.size);

    // 4) Compute desired state
    type DesiredClaim = {
      tile_x: number;
      tile_y: number;
      owner_auth_id: string;
      owner_scan_count: number;
      claim_group_name: string | null;
      claimed_at: string;
      updated_at: string;
    };

    const upserts: DesiredClaim[] = [];
    const deleteKeys: string[] = [];
    const now = new Date().toISOString();

    // All tiles with at least one scan entry
    for (const [key, authMap] of scanCountByTile) {
      const [tileXStr, tileYStr] = key.split(":");
      const tileX = Number(tileXStr);
      const tileY = Number(tileYStr);

      const rankedCounts = Array.from(authMap.entries())
        .sort((a, b) => {
          if (b[1] !== a[1]) return b[1] - a[1];
          return a[0].localeCompare(b[0]);
        });

      const topCount = rankedCounts[0]?.[1] || 0;
      const existing = existingByKey.get(key) || null;

      if (topCount < CLAIM_THRESHOLD) {
        // No one qualifies → delete existing claim if any
        if (existing) {
          deleteKeys.push(key);
        }
        continue;
      }

      const topOwners = rankedCounts.filter((e) => e[1] === topCount);

      if (topOwners.length !== 1) {
        // Tie → no claim
        if (existing) {
          deleteKeys.push(key);
        }
        continue;
      }

      const [nextOwnerAuthId, nextOwnerScanCount] = topOwners[0];

      // Preserve claim_group_name and claimed_at if ownership is unchanged
      const claimedAt = existing?.claimed_at || now;
      const claimGroupName = existing && existing.owner_auth_id === nextOwnerAuthId
        ? (existing.claim_group_name || null)
        : null;

      upserts.push({
        tile_x: tileX,
        tile_y: tileY,
        owner_auth_id: nextOwnerAuthId,
        owner_scan_count: nextOwnerScanCount,
        claim_group_name: claimGroupName,
        claimed_at: claimedAt,
        updated_at: now,
      });
    }

    // Any existing claim for a tile that has NO scans at all since cutoff → delete
    for (const [key, existing] of existingByKey) {
      if (!scanCountByTile.has(key) && !deleteKeys.includes(key)) {
        deleteKeys.push(key);
      }
    }

    console.log(
      `[backfillTileClaims] Plan: ${upserts.length} upserts, ${deleteKeys.length} deletes (dryRun=${dryRun})`,
    );

    if (dryRun) {
      return jsonResponse({
        success: true,
        dryRun: true,
        plannedUpserts: upserts.length,
        plannedDeletes: deleteKeys.length,
        sampleUpserts: upserts.slice(0, 10),
        sampleDeletes: deleteKeys.slice(0, 10),
      });
    }

    // 5) Execute deletes in batches
    let deletedCount = 0;
    const BATCH_SIZE = 200;

    for (const key of deleteKeys) {
      const [tileXStr, tileYStr] = key.split(":");
      const tileX = Number(tileXStr);
      const tileY = Number(tileYStr);
      const { error: deleteError } = await adminClient
        .from("TileClaim")
        .delete()
        .eq("tile_x", tileX)
        .eq("tile_y", tileY);

      if (deleteError) {
        console.warn("[backfillTileClaims] Delete failed for", key, deleteError.message);
      } else {
        deletedCount++;
      }
    }

    // 6) Execute upserts in batches
    let upsertedCount = 0;
    for (let i = 0; i < upserts.length; i += BATCH_SIZE) {
      const batch = upserts.slice(i, i + BATCH_SIZE);
      const { error: upsertError } = await adminClient
        .from("TileClaim")
        .upsert(batch, { onConflict: "tile_x,tile_y", ignoreDuplicates: false });

      if (upsertError) {
        console.error("[backfillTileClaims] Upsert batch failed", upsertError.message);
        return jsonResponse({ error: "Upsert failed: " + upsertError.message }, 500);
      }
      upsertedCount += batch.length;
    }

    // 7) Sync claimed_tiles_count for all affected RobotPlant rows
    const affectedAuthIds = new Set<string>();
    for (const u of upserts) affectedAuthIds.add(u.owner_auth_id);
    for (const key of deleteKeys) {
      const existing = existingByKey.get(key);
      if (existing) affectedAuthIds.add(existing.owner_auth_id);
    }

    let syncedUsers = 0;
    for (const authId of affectedAuthIds) {
      const { count } = await adminClient
        .from("TileClaim")
        .select("tile_x", { count: "exact", head: true })
        .eq("owner_auth_id", authId);

      const claimedCount = Math.max(0, Number(count ?? 0));

      const { error: syncError } = await adminClient
        .from("RobotPlant")
        .update({ claimed_tiles_count: claimedCount })
        .eq("auth_id", authId);

      if (syncError) {
        console.warn("[backfillTileClaims] RobotPlant sync failed for", authId, syncError.message);
      } else {
        syncedUsers++;
      }
    }

    console.log(`[backfillTileClaims] Done: ${upsertedCount} upserted, ${deletedCount} deleted, ${syncedUsers} users synced`);

    return jsonResponse({
      success: true,
      upsertedCount,
      deletedCount,
      syncedUsers,
      tilesEvaluated: scanCountByTile.size,
      discoveriesLoaded: discoveries?.length ?? 0,
    });
  } catch (error) {
    console.error("[backfillTileClaims] Unexpected error", error);
    return jsonResponse({ error: "Unexpected error: " + String(error) }, 500);
  }
});
