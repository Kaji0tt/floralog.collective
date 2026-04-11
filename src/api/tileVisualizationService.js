import { supabaseClient } from "@/api/supabaseClient";

export async function getTileVisualization(
  authId: string,
  latitude: number,
  longitude: number,
  radiusM = 2000
) {
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/getTileVisualization`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${(await supabaseClient.auth.getSession()).data.session?.access_token}`,
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
