import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildOriginDeniedResponse } from "../_shared/origin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type RenameBody = {
  tileX?: number;
  tileY?: number;
  groupName?: string;
};

type OwnerTileRow = {
  tile_x: number;
  tile_y: number;
};

const BAD_WORD_PATTERNS: RegExp[] = [
  /\bfuck(?:er|ing|ed|s)?\b/i,
  /\bshit(?:ty|head|hole|s)?\b/i,
  /\bbitch(?:es|y)?\b/i,
  /\basshole\b/i,
  /\bcunt\b/i,
  /\bdick(?:head)?\b/i,
  /\bslut\b/i,
  /\bwhore\b/i,
  /\bmotherfucker\b/i,
  /\bschei(?:ss|s)e\b/i,
  /\bschei(?:ss|s)\b/i,
  /\barschloch\b/i,
  /\bwichser\b/i,
  /\bfotze\b/i,
  /\bfick(?:en|er|e|t)?\b/i,
  /\bhurensohn\b/i,
  /\bmissgeburt\b/i,
];

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function normalizeForModeration(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/7/g, "t")
    .replace(/8/g, "b")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasProfanity(value: string): boolean {
  if (!value) return false;
  const normalized = normalizeForModeration(value);
  if (!normalized) return false;
  return BAD_WORD_PATTERNS.some((pattern) => pattern.test(normalized));
}

function isFiniteInteger(value: unknown): value is number {
  return Number.isFinite(value) && Number.isInteger(value);
}

function tileKey(tileX: number, tileY: number): string {
  return `${tileX}:${tileY}`;
}

function getConnectedOwnerTiles(seedX: number, seedY: number, ownerTiles: OwnerTileRow[]): OwnerTileRow[] {
  const byKey = new Map<string, OwnerTileRow>();
  ownerTiles.forEach((tile) => {
    byKey.set(tileKey(tile.tile_x, tile.tile_y), tile);
  });

  const startKey = tileKey(seedX, seedY);
  if (!byKey.has(startKey)) return [];

  const visited = new Set<string>();
  const queue: string[] = [startKey];
  const connected: OwnerTileRow[] = [];

  while (queue.length > 0) {
    const currentKey = queue.shift();
    if (!currentKey || visited.has(currentKey)) continue;

    visited.add(currentKey);
    const currentTile = byKey.get(currentKey);
    if (!currentTile) continue;

    connected.push(currentTile);

    const neighbors = [
      tileKey(currentTile.tile_x + 1, currentTile.tile_y),
      tileKey(currentTile.tile_x - 1, currentTile.tile_y),
      tileKey(currentTile.tile_x, currentTile.tile_y + 1),
      tileKey(currentTile.tile_x, currentTile.tile_y - 1),
    ];

    neighbors.forEach((neighborKey) => {
      if (!visited.has(neighborKey) && byKey.has(neighborKey)) {
        queue.push(neighborKey);
      }
    });
  }

  return connected;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const originDeniedResponse = buildOriginDeniedResponse(req, corsHeaders, "renameTileClaimGroup");
  if (originDeniedResponse) {
    return originDeniedResponse;
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return jsonResponse({ error: "Supabase configuration missing" }, 500);
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: req.headers.get("Authorization") ?? "",
        },
      },
      auth: { persistSession: false },
    });

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();

    if (authError || !user?.id) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const body = (await req.json()) as RenameBody;
    const tileX = Number(body.tileX);
    const tileY = Number(body.tileY);
    const groupName = String(body.groupName || "").trim();

    if (!isFiniteInteger(tileX) || !isFiniteInteger(tileY)) {
      return jsonResponse({ error: "tileX and tileY must be integers" }, 400);
    }

    if (groupName.length < 3 || groupName.length > 48) {
      return jsonResponse({ error: "Name must be between 3 and 48 characters" }, 400);
    }

    if (hasProfanity(groupName)) {
      return jsonResponse(
        {
          error: "Der Name enthaelt unzulaessige Begriffe (DE/EN Schimpfwortfilter). Bitte waehle einen anderen Namen.",
          code: "PROFANITY_DETECTED",
        },
        400,
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: ownerTiles, error: ownerTilesError } = await adminClient
      .from("TileClaim")
      .select("tile_x, tile_y")
      .eq("owner_auth_id", user.id);

    if (ownerTilesError) {
      console.error("[renameTileClaimGroup] Failed to load owner tiles", ownerTilesError);
      return jsonResponse({ error: "Failed to load owner tile group" }, 500);
    }

    const connectedTiles = getConnectedOwnerTiles(tileX, tileY, (ownerTiles || []) as OwnerTileRow[]);
    if (connectedTiles.length === 0) {
      return jsonResponse({ error: "Tile is not owned by current user" }, 403);
    }

    for (const tile of connectedTiles) {
      const { error: updateError } = await adminClient
        .from("TileClaim")
        .update({ claim_group_name: groupName, updated_at: new Date().toISOString() })
        .eq("owner_auth_id", user.id)
        .eq("tile_x", tile.tile_x)
        .eq("tile_y", tile.tile_y);

      if (updateError) {
        console.error("[renameTileClaimGroup] Update failed", updateError);
        return jsonResponse({ error: "Failed to save tile group name" }, 500);
      }
    }

    return jsonResponse({
      success: true,
      groupName,
      updatedCount: connectedTiles.length,
      tileX,
      tileY,
    });
  } catch (error) {
    console.error("[renameTileClaimGroup] Unexpected error", error);
    return jsonResponse({ error: "Unexpected error" }, 500);
  }
});
