import { supabase } from "@/api/supabaseClient";

/**
 * Zentrale Funktion zum Prüfen und Freischalten von Rewards.
 * Die komplette Logik läuft jetzt in der Edge Function `grantRewards`.
 */
export async function checkAndUnlockRewards(user) {
  try {
    if (!user?.id || !user?.email) {
      return 0;
    }

    const { data, error } = await supabase.functions.invoke("grantRewards", {
      body: {},
    });

    if (error) {
      console.error("[RewardUnlocker] Fehler beim Aufruf von grantRewards:", error);
      return 0;
    }

    return data?.newRewardsCount ?? 0;
  } catch (error) {
    console.error("[RewardUnlocker] Unerwarteter Fehler:", error);
    return 0;
  }
}

