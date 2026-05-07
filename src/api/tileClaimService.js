import { supabase } from "@/api/supabaseClient";

const getCurrentAuthId = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;

  const authId = data?.user?.id;
  if (!authId) {
    throw new Error("Authenticated user is required");
  }

  return authId;
};

export const getTileClaims = async ({ latitude, longitude, radiusM = 1500 }) => {
  const authId = await getCurrentAuthId();

  const { data, error } = await supabase.functions.invoke("getTileClaims", {
    body: {
      authId,
      latitude,
      longitude,
      radiusM,
    },
  });

  if (error) {
    throw error;
  }

  if (!data?.success) {
    throw new Error(data?.error || "Failed to load tile claims");
  }

  return Array.isArray(data.claims) ? data.claims : [];
};
