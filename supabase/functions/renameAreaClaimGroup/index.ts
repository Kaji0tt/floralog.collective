import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildOriginDeniedResponse } from "../_shared/origin.ts";
import { getSupabasePublishableKey } from "../_shared/supabaseKeys.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type RenameBody = {
  areaX?: number;
  areaY?: number;
  groupName?: string;
};

type OwnerAreaRow = {
  area_x: number;
  area_y: number;
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

function areaKey(areaX: number, areaY: number): string {
  return `${areaX}:${areaY}`;
}

function getConnectedOwnerAreas(seedX: number, seedY: number, ownerAreas: OwnerAreaRow[]): OwnerAreaRow[] {
  const byKey = new Map<string, OwnerAreaRow>();
  ownerAreas.forEach((area) => {
    byKey.set(areaKey(area.area_x, area.area_y), area);
  });

  const startKey = areaKey(seedX, seedY);
  if (!byKey.has(startKey)) return [];

  const visited = new Set<string>();
  const queue: string[] = [startKey];
  const connected: OwnerAreaRow[] = [];

  while (queue.length > 0) {
    const currentKey = queue.shift();
    if (!currentKey || visited.has(currentKey)) continue;

    visited.add(currentKey);
    const currentArea = byKey.get(currentKey);
    if (!currentArea) continue;

    connected.push(currentArea);

    const neighbors = [
      areaKey(currentArea.area_x + 1, currentArea.area_y),
      areaKey(currentArea.area_x - 1, currentArea.area_y),
      areaKey(currentArea.area_x, currentArea.area_y + 1),
      areaKey(currentArea.area_x, currentArea.area_y - 1),
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

  const originDeniedResponse = buildOriginDeniedResponse(req, corsHeaders, "renameAreaClaimGroup");
  if (originDeniedResponse) {
    return originDeniedResponse;
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabasePublishableKey = getSupabasePublishableKey();
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabasePublishableKey || !serviceRoleKey) {
      return jsonResponse({ error: "Supabase configuration missing" }, 500);
    }

    const authClient = createClient(supabaseUrl, supabasePublishableKey, {
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
    const areaX = Number(body.areaX);
    const areaY = Number(body.areaY);
    const groupName = String(body.groupName || "").trim();

    if (!isFiniteInteger(areaX) || !isFiniteInteger(areaY)) {
      return jsonResponse({ error: "areaX and areaY must be integers" }, 400);
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

    const { data: ownerAreas, error: ownerAreasError } = await adminClient
      .from("AreaClaim")
      .select("area_x, area_y")
      .eq("owner_auth_id", user.id);

    if (ownerAreasError) {
      console.error("[renameAreaClaimGroup] Failed to load owner areas", ownerAreasError);
      return jsonResponse({ error: "Besitzte Areale konnten nicht geladen werden." }, 500);
    }

    const connectedAreas = getConnectedOwnerAreas(areaX, areaY, (ownerAreas || []) as OwnerAreaRow[]);
    if (connectedAreas.length === 0) {
      return jsonResponse({ error: "Dieses Areal gehoert nicht dem aktuellen Nutzer." }, 403);
    }

    for (const area of connectedAreas) {
      const { error: updateError } = await adminClient
        .from("AreaClaim")
        .update({ claim_group_name: groupName, updated_at: new Date().toISOString() })
        .eq("owner_auth_id", user.id)
        .eq("area_x", area.area_x)
        .eq("area_y", area.area_y);

      if (updateError) {
        console.error("[renameAreaClaimGroup] Update failed", updateError);
        return jsonResponse({ error: "Arealname konnte nicht gespeichert werden." }, 500);
      }
    }

    return jsonResponse({
      success: true,
      groupName,
      updatedCount: connectedAreas.length,
      areaX,
      areaY,
    });
  } catch (error) {
    console.error("[renameAreaClaimGroup] Unexpected error", error);
    return jsonResponse({ error: "Unexpected error" }, 500);
  }
});
