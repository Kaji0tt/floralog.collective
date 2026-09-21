import { supabase } from "@/api/supabaseClient";

export const grantScanZoneUnlocks = async ({ discoveryId, plantId = null, discoveryLocation = null }) => {
  const { data, error } = await supabase.functions.invoke("grantScanZoneUnlocks", {
    body: {
      discoveryId,
      plantId,
      discoveryLocation,
    },
  });

  if (error) {
    throw error;
  }

  if (!data?.success) {
    throw new Error(data?.error || "Scan-Zonen-Freischaltung fehlgeschlagen.");
  }

  const unlocked = Array.isArray(data?.unlocked) ? data.unlocked : [];
  unlocked.zoneProgress = data?.zoneProgress || null;
  return unlocked;
};