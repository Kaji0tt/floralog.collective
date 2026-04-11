import { supabase } from "@/api/supabaseClient";

export async function getTileVisualization(
  authId,
  latitude,
  longitude,
  radiusM = 2000
) {
  const sessionResult = await supabase.auth.getSession();
  const accessToken = sessionResult?.data?.session?.access_token;

  if (!accessToken) {
    throw new Error("Not authenticated");
  }

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/getTileVisualization`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        authId,
        latitude,
        longitude,
        radiusM,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to get tile visualization");
  }

  return response.json();
}
