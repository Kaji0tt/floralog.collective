import { supabase } from "@/api/supabaseClient";

/**
 * Prüft ob zufällige Rewards bei einem Event freigeschaltet werden sollen.
 * Die eigentliche Logik läuft in der Edge Function `grantRewards`.
 */
export async function checkRandomRewards(user, eventType) {
  try {
    if (!user?.id || !user?.email) {
      return [];
    }

    const { data, error } = await supabase.functions.invoke("grantRewards", {
      body: { eventType },
    });

    if (error) {
      console.error("[RandomRewardChecker] Fehler beim Aufruf von grantRewards:", error);
      return [];
    }

    // Wir liefern nur die IDs der zufällig freigeschalteten Rewards zurück
    return data?.randomUnlocked ?? [];
  } catch (error) {
    console.error("[RandomRewardChecker] Unerwarteter Fehler:", error);
    return [];
  }
}

