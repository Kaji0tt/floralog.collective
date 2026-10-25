import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSupabaseSecretKey } from "../_shared/supabaseKeys.ts";

const HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
const PAGE_SIZE = 1000;
const BACKFILL_DATE = "2026-07-07";
const BACKFILL_SOURCES = [
  "user_quest_completion",
  "weekly_quest_completion",
  "monthly_quest_completion",
  "collection_quest_completion",
  "daily_challenge_completion",
];

type Row = Record<string, unknown>;

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: HEADERS });
}

async function secretsMatch(provided: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const left = new Uint8Array(providedHash);
  const right = new Uint8Array(expectedHash);
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

async function fetchRows(
  fetchPage: (from: number, to: number) => PromiseLike<{
    data: Row[] | null;
    error: { message: string } | null;
  }>,
): Promise<Row[]> {
  const rows: Row[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await fetchPage(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

async function fetchByIds(
  ids: string[],
  fetchPage: (ids: string[], from: number, to: number) => PromiseLike<{
    data: Row[] | null;
    error: { message: string } | null;
  }>,
): Promise<Row[]> {
  const rows: Row[] = [];
  for (let offset = 0; offset < ids.length; offset += 500) {
    rows.push(...await fetchRows((from, to) =>
      fetchPage(ids.slice(offset, offset + 500), from, to)));
  }
  return rows;
}

function isoWeekNumber(date: Date): number {
  const thursday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  thursday.setUTCDate(thursday.getUTCDate() + 4 - (thursday.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  return Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function isPublicProfile(profile: Row | undefined): boolean {
  return Boolean(profile) &&
    profile?.public_profile !== false &&
    profile?.global_explorer_visibility !== false;
}

function publicName(profile: Row | undefined): string {
  if (!isPublicProfile(profile)) return "Entdecker:in";
  return String(profile?.display_name || profile?.full_name || "Entdecker:in");
}

function rarityLevel(value: unknown): number {
  const normalized = String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  if (/ausgestorben|verschollen/.test(normalized)) return 6;
  if (/extrem\s*selten/.test(normalized)) return 5;
  if (/sehr\s*selten/.test(normalized)) return 4;
  if (/\bselten\b/.test(normalized)) return 3;
  if (/gelegentlich|ungewohnlich/.test(normalized)) return 2;
  if (/haufig|common/.test(normalized)) return 1;
  return 1;
}

Deno.serve(async (req) => {
  if (req.method !== "GET") return jsonResponse({ error: "Method not allowed" }, 405);

  const expectedSecret = Deno.env.get("AI_KPI_SECRET")?.trim() || "";
  const providedSecret = req.headers.get("x-floralog-ai-secret")?.trim() || "";
  if (!expectedSecret || !providedSecret || !(await secretsMatch(providedSecret, expectedSecret))) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const requestedWeek = new URL(req.url).searchParams.get("week_start");
  const weekStart = requestedWeek
    ? new Date(requestedWeek)
    : new Date(Date.now() - 7 * 86400000);
  if (Number.isNaN(weekStart.getTime())) return jsonResponse({ error: "Invalid week_start" }, 400);
  if (requestedWeek && weekStart.getUTCDay() !== 1) {
    return jsonResponse({ error: "week_start must be a Monday" }, 400);
  }
  weekStart.setUTCHours(0, 0, 0, 0);
  weekStart.setUTCDate(weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7));
  const weekEnd = new Date(weekStart.getTime() + 7 * 86400000);
  const weekStartIso = weekStart.toISOString();
  const weekEndIso = weekEnd.toISOString();
  const excludeBackfill = BACKFILL_DATE >= weekStartIso.slice(0, 10) &&
    BACKFILL_DATE < weekEndIso.slice(0, 10);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const secretKey = getSupabaseSecretKey();
  if (!supabaseUrl || !secretKey) return jsonResponse({ error: "Service not configured" }, 500);

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const [discoveries, newProfiles, ledger, quests] = await Promise.all([
      fetchRows((from, to) =>
        admin.from("UserPlantDiscovery").select("id, plant_id, auth_id, image_url")
          .gte("discovered_date", weekStartIso).lt("discovered_date", weekEndIso).range(from, to)),
      fetchRows((from, to) =>
        admin.from("PublicProfile").select("id")
          .gte("created_date", weekStartIso).lt("created_date", weekEndIso).range(from, to)),
      fetchRows((from, to) =>
        admin.from("RobotPlantWalletLedger")
          .select("auth_id, amount, event_source, created_at")
          .eq("currency_code", "seed").eq("direction", "credit").gt("amount", 0)
          .gte("created_at", weekStartIso).lt("created_at", weekEndIso).range(from, to)),
      fetchRows((from, to) =>
        admin.from("WeeklyQuest")
          .select("id, title, target_species_name, target_genus_name, quest_number")
          .order("quest_number", { ascending: true }).range(from, to)),
    ]);

    const discoveryIds = discoveries.map((row) => String(row.id)).filter(Boolean);
    const plantIds = [...new Set(discoveries.map((row) => String(row.plant_id || "")).filter(Boolean))];
    const [likes, plants] = await Promise.all([
      discoveryIds.length
        ?         fetchByIds(discoveryIds, (ids, from, to) =>
          admin.from("ScanLike").select("discovery_id")
            .in("discovery_id", ids).range(from, to))
        : Promise.resolve([]),
      plantIds.length
          ? fetchByIds(plantIds, (ids, from, to) =>
          admin.from("Plant").select("id, species_name, rarity, genus_category, genus_number")
              .in("id", ids).range(from, to))
        : Promise.resolve([]),
    ]);

    const plantById = new Map(plants.map((plant) => [String(plant.id), plant]));
    const likesByDiscovery = new Map<string, number>();
    for (const like of likes) {
      const id = String(like.discovery_id || "");
      if (id) likesByDiscovery.set(id, (likesByDiscovery.get(id) ?? 0) + 1);
    }

    const questIndex = quests.length ? (isoWeekNumber(weekStart) - 1) % quests.length : -1;
    const quest = questIndex >= 0 ? quests[questIndex] : undefined;
    let questMatches = discoveries.filter((discovery) => {
      const plant = plantById.get(String(discovery.plant_id || ""));
      if (quest?.target_species_name) return plant?.species_name === quest.target_species_name;
      return false;
    });
    if (quest?.target_genus_name && !quest?.target_species_name) {
      const { data: genus, error } = await admin.from("PlantGenus")
        .select("category, category_dex_number")
        .eq("genus_name", quest.target_genus_name).maybeSingle();
      if (error) throw new Error(error.message);
      if (genus) {
        questMatches = discoveries.filter((discovery) => {
          const plant = plantById.get(String(discovery.plant_id || ""));
          return plant?.genus_category === genus.category &&
            Number(plant?.genus_number) === Number(genus.category_dex_number);
        });
      } else {
        questMatches = [];
      }
    }

    const authIds = [...new Set([
      ...ledger.map((row) => String(row.auth_id || "")),
      ...questMatches.map((row) => String(row.auth_id || "")),
    ].filter(Boolean))];
    const topDiscovery = discoveries
      .map((discovery) => ({
        discovery,
        likeCount: likesByDiscovery.get(String(discovery.id)) ?? 0,
      }))
      .filter((item) => item.likeCount > 0)
      .sort((a, b) => b.likeCount - a.likeCount)[0];
    if (topDiscovery?.discovery.auth_id) authIds.push(String(topDiscovery.discovery.auth_id));

    const profiles = authIds.length
      ? await fetchByIds([...new Set(authIds)], (ids, from, to) =>
        admin.from("PublicProfile")
          .select([
            "auth_id",
            "display_name",
            "full_name",
            "public_profile",
            "global_explorer_visibility",
            "bot_name",
            "selected_face_asset",
            "selected_plant_asset",
            "selected_border_asset",
            "selected_border_color",
          ].join(","))
          .in("auth_id", ids).range(from, to))
      : [];
    const profileByAuthId = new Map(profiles.map((profile) => [String(profile.auth_id), profile]));
    const logoAssetIds = [...new Set(profiles
      .filter(isPublicProfile)
      .flatMap((profile) => [
        String(profile.selected_face_asset || ""),
        String(profile.selected_plant_asset || ""),
        String(profile.selected_border_asset || ""),
      ])
      .filter(Boolean))];
    const logoAssets = logoAssetIds.length
      ? await fetchByIds(logoAssetIds, (ids, from, to) =>
        admin.from("LogoAsset").select("asset_id, asset_type, public_url, active")
          .in("asset_id", ids).eq("active", true).range(from, to))
      : [];
    const logoAssetUrlById = new Map(logoAssets.map((asset) => [
      String(asset.asset_id),
      String(asset.public_url),
    ]));

    const avatarForProfile = (profile: Row | undefined) => {
      if (!isPublicProfile(profile)) return null;
      const resolve = (field: string) => {
        const assetId = String(profile?.[field] || "");
        return logoAssetUrlById.get(assetId) || null;
      };
      return {
        face: resolve("selected_face_asset"),
        plant: resolve("selected_plant_asset"),
        border: resolve("selected_border_asset"),
        border_color: profile?.selected_border_color || null,
      };
    };

    const plantCounts = new Map<string, number>();
    for (const discovery of discoveries) {
      const plantId = String(discovery.plant_id || "");
      if (plantId) plantCounts.set(plantId, (plantCounts.get(plantId) ?? 0) + 1);
    }
    const topPlant = [...plantCounts.entries()].sort((a, b) => b[1] - a[1])[0];

    const seedTotals = new Map<string, number>();
    for (const row of ledger) {
      const authId = String(row.auth_id || "");
      if (!authId) continue;
      const backfillRow = excludeBackfill &&
        String(row.created_at || "").slice(0, 10) === BACKFILL_DATE &&
        BACKFILL_SOURCES.includes(String(row.event_source));
      if (!backfillRow) seedTotals.set(authId, (seedTotals.get(authId) ?? 0) + Number(row.amount || 0));
    }
    const leaderboard = [...seedTotals.entries()]
      .filter(([, total]) => total > 0)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 5)
      .map(([authId, total]) => {
        const profile = profileByAuthId.get(authId);
        return {
          name: publicName(profile),
          avatar: avatarForProfile(profile),
          weekly_seed_total: total,
        };
      });

    const uniqueScanners = new Set(discoveries.map((row) => String(row.auth_id || "")).filter(Boolean));
    const distinctSpecies = new Set(discoveries.map((row) => String(row.plant_id || "")).filter(Boolean));
    const questDiscoverers = [...new Set(questMatches
      .map((row) => publicName(profileByAuthId.get(String(row.auth_id || "")))))]
      .slice(0, 5);
    const topScanRow = topDiscovery?.discovery;
    const topScanPlant = topScanRow ? plantById.get(String(topScanRow.plant_id || "")) : undefined;
    const topScanProfile = topScanRow?.auth_id
      ? profileByAuthId.get(String(topScanRow.auth_id))
      : undefined;

    return jsonResponse({
      week_start: weekStartIso,
      week_end: weekEndIso,
      seeds_earned: [...seedTotals.values()].reduce((sum, total) => sum + total, 0),
      unique_scanners: uniqueScanners.size,
      new_players: newProfiles.length,
      total_scans: discoveries.length,
      distinct_species: distinctSpecies.size,
      rare_scans: discoveries.filter((row) =>
        rarityLevel(plantById.get(String(row.plant_id || ""))?.rarity) >= 4).length,
      total_likes: likes.length,
      top_plant_name: topPlant ? plantById.get(topPlant[0])?.species_name ?? null : null,
      top_plant_count: topPlant?.[1] ?? 0,
      quest_plant_label: quest?.target_species_name || quest?.target_genus_name || null,
      quest_finds: questMatches.length,
      quest_discoverers: questDiscoverers,
      leaderboard,
      top_scan: topDiscovery && topScanRow
        ? {
          like_count: topDiscovery.likeCount,
          species_name: topScanPlant?.species_name || "Unbekannte Art",
          rarity: topScanPlant?.rarity ?? null,
          display_name: publicName(topScanProfile),
          avatar: avatarForProfile(topScanProfile),
          image_url: isPublicProfile(topScanProfile) ? topScanRow.image_url ?? null : null,
        }
        : null,
    });
  } catch (error) {
    console.error("[adminWeeklyReportSnapshot] Snapshot query failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return jsonResponse({ error: "Weekly report snapshot unavailable" }, 503);
  }
});
