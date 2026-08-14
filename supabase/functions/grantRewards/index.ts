import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildOriginDeniedResponse } from "../_shared/origin.ts";
import { buildNotificationPayload } from "../_shared/notificationCopy.ts";
import { getRarityLevelFromLabel } from "../_shared/plantRarityLevels.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

console.log("[grantRewards] Function loaded successfully");

type RewardRow = {
  id: string;
  name: string | null;
  display_name: string | null;
  value: string | null;
  image_url: string | null;
  type: string | null;
  requires_weekly_quests?: number | null;
  requires_monthly_quests?: number | null;
  requires_gifts?: number | null;
  requires_donor?: boolean | null;
  requires_referrals?: number | null;
  requires_referred_seeds_progress?: number | null;
  requires_rare_plants?: number | null;
  requires_quest?: string | null;
  random_event?: string | null;
  random_chance?: number | null;
};

type UserRewardRow = {
  reward_id: string;
};

type QuestRow = {
  id: string;
  reward_name?: string | null;
};

type WeeklyQuestRow = {
  id: string;
  reward_name?: string | null;
};

type MonthlyQuestRow = {
  id: string;
  reward_name?: string | null;
};

type UserQuestRow = {
  quest_id: string | null;
  redeemed: boolean | null; // legacy
  status?: string | null; // 'active' | 'completed' | 'redeemed'
};

type UserWeeklyQuestRow = {
  weekly_quest_id: string | null;
  redeemed: boolean | null; // legacy
  active_week: string | null;
  status?: string | null;
};

type UserMonthlyQuestRow = {
  monthly_quest_id: string | null;
  redeemed: boolean | null; // legacy
  completed: boolean | null; // legacy
  status?: string | null;
};

type SharedScanRow = {
  id: string;
};

type UserPlantDiscoveryRow = {
  plant_id: string | null;
};

type PlantRow = {
  id: string;
  rarity?: string | null;
};

type ProfileRow = {
  auth_id?: string | null;
  user_email?: string | null;
  display_name?: string | null;
  full_name?: string | null;
  donor_status?: boolean | null;
};

type ReferralRow = {
  referred_email?: string | null;
  // auth_id = referred user's auth_id (set by friendService on insert; stable across email changes)
  auth_id?: string | null;
  status?: string | null;
};

type WalletRow = {
  auth_id: string;
  seeds_progress?: number | null;
};

const normalizeEmail = (value: string | null | undefined): string => String(value || "").trim().toLowerCase();

interface GrantRewardsBody {
  eventType?: string | null;
}

async function createRewardNotification(params: {
  adminClient: ReturnType<typeof createClient>;
  accessToken: string;
  authId: string;
  userEmail: string;
  title: string;
  message: string;
  imageUrl?: string | null;
}): Promise<void> {
  const { adminClient, accessToken, authId, userEmail, title, message, imageUrl } = params;

  const invoke = await adminClient.functions.invoke("createNotification", {
    body: {
      authId,
      userEmail,
      notificationType: "custom",
      title,
      message,
      imageUrl: imageUrl || "",
      displayLocation: "banner",
      priority: "medium",
    },
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (invoke.error) {
    throw invoke.error;
  }

  if (!invoke.data?.success) {
    throw new Error(invoke.data?.error || "createNotification failed");
  }
}

function getAccessTokenFromAuthHeader(header: string | null): string | null {
  if (!header) return null;
  const parts = header.split(" ");
  if (parts.length === 2 && parts[0] === "Bearer") return parts[1];
  return header;
}

Deno.serve(async (req) => {
  console.log("[grantRewards] === REQUEST RECEIVED ===");
  console.log("[grantRewards] Method:", req.method);

  if (req.method === "OPTIONS") {
    console.log("[grantRewards] Handling OPTIONS request");
    return new Response(null, { headers: corsHeaders });
  }

  const originDeniedResponse = buildOriginDeniedResponse(req, corsHeaders, "grantRewards");
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[grantRewards] Missing service env vars");
      return new Response(
        JSON.stringify({ error: "Supabase service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const authHeader = req.headers.get("Authorization");
    const accessToken = getAccessTokenFromAuthHeader(authHeader);

    if (!accessToken) {
      console.warn("[grantRewards] Missing Authorization header");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Hole User aus dem JWT
    const { data: userData, error: userError } = await adminClient.auth.getUser(accessToken);

    if (userError || !userData?.user) {
      console.error("[grantRewards] Failed to get user from token:", userError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const user = userData.user;
    const authId = user.id;
    const userEmail = user.email || "";

    let eventType: string | null = null;
    try {
      const body = (await req.json()) as GrantRewardsBody;
      if (body && typeof body.eventType === "string") {
        eventType = body.eventType;
      }
    } catch (_e) {
      // Body optional – ist ok
    }

    console.log("[grantRewards] User:", authId, "eventType:", eventType);

    // Daten laden – analog zu rewardUnlocker/randomRewardChecker
    const [
      rewardsRes,
      userRewardsRes,
      userQuestsRes,
      userWeeklyQuestsRes,
      userMonthlyQuestsRes,
      sharedScansRes,
      userDiscoveriesRes,
      plantsRes,
      profileRes,
      questsRes,
      weeklyQuestsRes,
      monthlyQuestsRes,
      referralsRes,
    ] = await Promise.all([
      adminClient.from("Rewards").select("*"),
      adminClient.from("UserRewards").select("reward_id").eq("auth_id", authId),
      adminClient.from("UserQuest").select("quest_id, redeemed, status").eq("auth_id", authId),
      adminClient
        .from("UserWeeklyQuest")
        .select("weekly_quest_id, redeemed, active_week, status")
        .eq("auth_id", authId),
      adminClient
        .from("UserMonthlyQuest")
        .select("monthly_quest_id, redeemed, completed, status")
        .eq("auth_id", authId),
      adminClient.from("SharedScan").select("id").eq("auth_id_to", authId),
      adminClient.from("UserPlantDiscovery").select("plant_id").eq("auth_id", authId),
      adminClient.from("Plant").select("id, rarity"),
      adminClient.from("PublicProfile").select("display_name, full_name, donor_status").eq("auth_id", authId).maybeSingle(),
      adminClient.from("Quest").select("id, reward_name"),
      adminClient.from("WeeklyQuest").select("id, reward_name"),
      adminClient.from("MonthlyQuest").select("id, reward_name"),
      // Primary lookup: referrer_auth_id (stable across email changes).
      // Fallback: referrer_email case-insensitive match for rows that predate
      // referrer_auth_id storage (migration 054 backfills these).
      // Also select auth_id (= referred user's auth_id) to avoid the downstream
      // email → PublicProfile → auth_id resolution whenever possible.
      adminClient
        .from("Referral")
        .select("referred_email, auth_id, status")
        .or(`referrer_auth_id.eq.${authId},referrer_email.eq.${normalizeEmail(userEmail)}`),
    ] as const);

    const rewards = (rewardsRes.data || []) as RewardRow[];
    const userRewards = (userRewardsRes.data || []) as UserRewardRow[];
    const userQuests = (userQuestsRes.data || []) as UserQuestRow[];
    const userWeeklyQuests = (userWeeklyQuestsRes.data || []) as UserWeeklyQuestRow[];
    const userMonthlyQuests = (userMonthlyQuestsRes.data || []) as UserMonthlyQuestRow[];
    const sharedScans = (sharedScansRes.data || []) as SharedScanRow[];
    const userDiscoveries = (userDiscoveriesRes.data || []) as UserPlantDiscoveryRow[];
    const plants = (plantsRes.data || []) as PlantRow[];
    const profile = (profileRes.data || {}) as ProfileRow;
    const quests = (questsRes.data || []) as QuestRow[];
    const weeklyQuests = (weeklyQuestsRes.data || []) as WeeklyQuestRow[];
    const monthlyQuests = (monthlyQuestsRes.data || []) as MonthlyQuestRow[];
    const referrals = (referralsRes.data || []) as ReferralRow[];

    const completedReferrals = referrals.filter((referral) => {
      const status = String(referral?.status || "").trim().toLowerCase();
      return status === "completed" || status === "accepted";
    });

    // Preferred path: use the referred user's auth_id stored directly on the Referral row.
    // This is stable even when the referred user changes their email.
    const completedReferredAuthIdSet = new Set<string>(
      completedReferrals
        .map((r) => String(r?.auth_id || "").trim())
        .filter(Boolean),
    );

    // Legacy fallback: rows that predate auth_id storage (very old Referral rows).
    // Only use email-based resolution when auth_id is absent on the row.
    const completedReferralEmailsLegacy = Array.from(
      new Set(
        completedReferrals
          .filter((r) => !r.auth_id)
          .map((r) => normalizeEmail(r.referred_email))
          .filter(Boolean),
      ),
    );

    const requiredReferralSeedThresholds = Array.from(
      new Set(
        rewards
          .map((reward) => Number(reward?.requires_referred_seeds_progress || 0))
          .filter((threshold) => Number.isFinite(threshold) && threshold > 0),
      ),
    );

    const qualifiedReferralCountBySeedThreshold = new Map<number, number>();
    const totalReferredCount = completedReferredAuthIdSet.size + completedReferralEmailsLegacy.length;
    if (requiredReferralSeedThresholds.length > 0 && totalReferredCount > 0) {
      // Collect all referred auth_ids: direct + resolved from legacy emails
      const allReferredAuthIds = Array.from(completedReferredAuthIdSet);

      if (completedReferralEmailsLegacy.length > 0) {
        const { data: legacyProfilesData, error: legacyProfilesError } = await adminClient
          .from("PublicProfile")
          .select("auth_id, user_email")
          .in("user_email", completedReferralEmailsLegacy);

        if (legacyProfilesError) {
          console.error("[grantRewards] Failed loading legacy referred profiles:", legacyProfilesError);
        } else {
          for (const p of (legacyProfilesData || []) as ProfileRow[]) {
            if (p.auth_id && !completedReferredAuthIdSet.has(p.auth_id)) {
              allReferredAuthIds.push(p.auth_id);
            }
          }
        }
      }

      if (allReferredAuthIds.length > 0) {
        const { data: referredWalletsData, error: referredWalletsError } = await adminClient
          .from("UserWallet")
          .select("auth_id, seeds_progress")
          .in("auth_id", allReferredAuthIds);

        if (referredWalletsError) {
          console.error("[grantRewards] Failed loading referred wallets:", referredWalletsError);
        } else {
          const walletSeedsByAuthId = new Map<string, number>();
          for (const wallet of (referredWalletsData || []) as WalletRow[]) {
            walletSeedsByAuthId.set(wallet.auth_id, Math.max(0, Number(wallet?.seeds_progress || 0)));
          }
          for (const threshold of requiredReferralSeedThresholds) {
            const qualifiedCount = allReferredAuthIds.filter(
              (id) => (walletSeedsByAuthId.get(id) || 0) >= threshold,
            ).length;
            qualifiedReferralCountBySeedThreshold.set(threshold, qualifiedCount);
          }
        }
      }
    }

    const unlockedRewardIds = new Set(userRewards.map((ur) => ur.reward_id));

    const hasReward = (rewardId: string | null | undefined) => {
      if (!rewardId) return false;
      return unlockedRewardIds.has(rewardId);
    };

    const unlockReward = async (reward: RewardRow): Promise<boolean> => {
      if (!reward.id || hasReward(reward.id)) return false;

      const displayName = profile.display_name || profile.full_name || userEmail;

      const { error: insertError } = await adminClient.from("UserRewards").insert({
        reward_id: reward.id,
        reward_name: reward.display_name,
        auth_id: authId,
        user_email: userEmail,
        user_name: displayName,
        unlocked_date: new Date().toISOString(),
      });

      if (insertError) {
        console.error("[grantRewards] Failed to insert UserReward:", insertError);
        return false;
      }

      unlockedRewardIds.add(reward.id);

      try {
        const rewardNotif = buildNotificationPayload("rewardUnlocked", {
          rewardName: reward.display_name || reward.name || "eine Belohnung",
        });
        await createRewardNotification({
          adminClient,
          accessToken,
          authId,
          userEmail,
          title: rewardNotif.title,
          message: rewardNotif.message,
          imageUrl: reward.image_url || reward.value,
        });
      } catch (notifError) {
        console.error("[grantRewards] Failed to create reward notification:", notifError);
      }

      return true;
    };

    // Statistiken berechnen
    const weeklyQuestParticipations = new Set(
      userWeeklyQuests
        .filter((q) => {
          // Zählt nur abgeschlossene oder eingelöste Weekly-Quests
          if (q.status) {
            return q.status === "completed" || q.status === "redeemed";
          }
          return !!q.redeemed; // Fallback für Legacy-Daten
        })
        .map((q) => q.active_week)
        .filter((w): w is string => !!w),
    ).size;

    const completedMonthlyQuests = userMonthlyQuests.filter((q) => {
      if (q.status) {
        return q.status === "completed" || q.status === "redeemed";
      }
      return !!q.completed || !!q.redeemed; // Legacy-Fallback
    }).length;
    const giftsReceived = sharedScans.length;
    const isDonor = !!profile.donor_status;
    const referralCount = completedReferredAuthIdSet.size + completedReferralEmailsLegacy.length;

    const rarePlantCount = userDiscoveries.filter((d) => {
      const plant = plants.find((p) => p.id === d.plant_id);
      return !!plant && getRarityLevelFromLabel(plant.rarity) >= 3;
    }).length;

    let newRewardsCount = 0;
    const randomUnlocked: string[] = [];

    // Nachträgliche Freischaltung basierend auf eingelösten Quests
    const isRedeemedStatus = (status: string | null | undefined): boolean => {
      return status === "redeemed";
    };

    const redeemedQuests = [
      ...userQuests
        .filter((uq) => (uq.status ? isRedeemedStatus(uq.status) : !!uq.redeemed))
        .map((uq) => ({ type: "regular" as const, userQuest: uq })),
      ...userWeeklyQuests
        .filter((uwq) => (uwq.status ? isRedeemedStatus(uwq.status) : !!uwq.redeemed))
        .map((uwq) => ({ type: "weekly" as const, userQuest: uwq })),
      ...userMonthlyQuests
        .filter((umq) => (umq.status ? isRedeemedStatus(umq.status) : !!umq.redeemed))
        .map((umq) => ({ type: "monthly" as const, userQuest: umq })),
    ];

    for (const { type, userQuest } of redeemedQuests) {
      let quest: QuestRow | WeeklyQuestRow | MonthlyQuestRow | undefined;
      if (type === "regular") {
        quest = quests.find((q) => q.id === userQuest.quest_id);
      } else if (type === "weekly") {
        quest = weeklyQuests.find((q) => q.id === userQuest.weekly_quest_id);
      } else {
        quest = monthlyQuests.find((q) => q.id === userQuest.monthly_quest_id);
      }

      if (quest?.reward_name) {
        const questReward = rewards.find((r) => r.name === quest!.reward_name);
        if (questReward && !hasReward(questReward.id)) {
          const unlocked = await unlockReward(questReward);
          if (unlocked) newRewardsCount++;
        }
      }
    }

    // Deterministische Rewards basierend auf Bedingungen
    for (const reward of rewards) {
      if (hasReward(reward.id)) continue;

      // Random-Event-Rewards werden separat unten behandelt
      if (reward.random_event && reward.random_chance) continue;

      const hasAnyCondition =
        reward.requires_weekly_quests ||
        reward.requires_monthly_quests ||
        reward.requires_gifts ||
        reward.requires_donor ||
        reward.requires_referrals ||
        reward.requires_rare_plants ||
        reward.requires_quest;

      if (!hasAnyCondition) continue;

      let conditionsMet = true;

      if (reward.requires_weekly_quests && weeklyQuestParticipations < reward.requires_weekly_quests) {
        conditionsMet = false;
      }

      if (reward.requires_monthly_quests && completedMonthlyQuests < reward.requires_monthly_quests) {
        conditionsMet = false;
      }

      if (reward.requires_gifts && giftsReceived < reward.requires_gifts) {
        conditionsMet = false;
      }

      if (reward.requires_donor && !isDonor) {
        conditionsMet = false;
      }

      if (reward.requires_referrals) {
        const requiredSeedThreshold = Number(reward.requires_referred_seeds_progress || 0);
        if (Number.isFinite(requiredSeedThreshold) && requiredSeedThreshold > 0) {
          const qualifiedCount = qualifiedReferralCountBySeedThreshold.get(requiredSeedThreshold) || 0;
          if (qualifiedCount < reward.requires_referrals) {
            conditionsMet = false;
          }
        } else if (referralCount < reward.requires_referrals) {
          conditionsMet = false;
        }
      }

      if (reward.requires_rare_plants && rarePlantCount < reward.requires_rare_plants) {
        conditionsMet = false;
      }

      if (reward.requires_quest) {
        const questCompleted = userQuests.some((uq) => {
          if (uq.quest_id !== reward.requires_quest) return false;
          if (uq.status) {
            return isRedeemedStatus(uq.status);
          }
          return !!uq.redeemed;
        });
        if (!questCompleted) {
          conditionsMet = false;
        }
      }

      if (!conditionsMet) continue;

      const unlocked = await unlockReward(reward);
      if (unlocked) newRewardsCount++;
    }

    // Zufalls-Rewards für das gegebene Event
    const randomUnlockedDetails: Array<{
      id: string;
      display_name: string | null;
      name: string | null;
      image_url: string | null;
      value: string | null;
      random_chance: number | null;
    }> = [];

    if (eventType) {
      const randomRewards = rewards.filter(
        (r) => r.random_event === eventType && r.random_chance && r.random_chance > 0,
      );

      for (const reward of randomRewards) {
        if (hasReward(reward.id)) continue;

        const chance = reward.random_chance || 0;
        if (chance <= 0) continue;

        const roll = Math.floor(Math.random() * chance) + 1;
        console.log(
          `[grantRewards] Rolling for ${reward.display_name || reward.name}: ${roll}/${chance}`,
        );

        if (roll === 1) {
          const unlocked = await unlockReward(reward);
          if (unlocked) {
            newRewardsCount++;
            randomUnlocked.push(reward.id);
            randomUnlockedDetails.push({
              id: reward.id,
              display_name: reward.display_name ?? null,
              name: reward.name ?? null,
              image_url: reward.image_url ?? null,
              value: reward.value ?? null,
              random_chance: reward.random_chance ?? null,
            });
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        newRewardsCount,
        randomUnlocked,
        randomUnlockedDetails,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error) {
    console.error("💥 [grantRewards] Unexpected error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
});

