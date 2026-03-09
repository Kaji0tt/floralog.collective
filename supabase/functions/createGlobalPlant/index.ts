import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

console.log("[createGlobalPlant] Function loaded successfully");

type CreateGlobalPlantBody = {
  plant: {
    species_name: string;
    scientific_name?: string | null;
    genus_name?: string | null;
    scientific_genus?: string | null;
    category: string;
    family?: string | null;
    description?: string | null;
    identification_features?: string | null;
    fun_fact?: string | null;
    rarity?: string | null;
  };
  image_url?: string | null;
  discovery_location?: string | null;
};

function generateLegacyHexId(): string {
  try {
    if (typeof crypto?.getRandomValues === "function") {
      const bytes = new Uint8Array(12);
      crypto.getRandomValues(bytes);
      return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    }
  } catch (error) {
    console.warn("[createGlobalPlant] crypto.getRandomValues unavailable, falling back to Math.random()", error);
  }

  return Array.from({ length: 12 }, () =>
    Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, "0"),
  ).join("");
}

function getAccessTokenFromAuthHeader(header: string | null): string | null {
  if (!header) return null;
  const parts = header.split(" ");
  if (parts.length === 2 && parts[0] === "Bearer") return parts[1];
  return header;
}

Deno.serve(async (req) => {
  console.log("[createGlobalPlant] === REQUEST RECEIVED ===");
  console.log("[createGlobalPlant] Method:", req.method);

  if (req.method === "OPTIONS") {
    console.log("[createGlobalPlant] Handling OPTIONS request");
    return new Response(null, { headers: corsHeaders });
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
      console.error("[createGlobalPlant] Missing Supabase service env vars");
      return new Response(
        JSON.stringify({ error: "Supabase service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const authHeader = req.headers.get("Authorization");
    const accessToken = getAccessTokenFromAuthHeader(authHeader);

    if (!accessToken) {
      console.warn("[createGlobalPlant] Missing Authorization header");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Aktuellen User aus dem JWT holen
    const { data: userData, error: userError } = await adminClient.auth.getUser(accessToken);

    if (userError || !userData?.user) {
      console.error("[createGlobalPlant] Failed to get user from token:", userError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const user = userData.user;
    const authId = user.id;
    const userEmail = user.email || "";

    const body = (await req.json()) as CreateGlobalPlantBody;
    const { plant, image_url, discovery_location } = body;

    if (!plant || !plant.species_name || !plant.category) {
      return new Response(
        JSON.stringify({ error: "plant.species_name and plant.category are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    console.log("[createGlobalPlant] Creating plant for user", authId, "plant:", plant.species_name);

    // 1) Gattung finden oder anlegen
    const { data: allGenera, error: generaError } = await adminClient
      .from("PlantGenus")
      .select("*");

    if (generaError) {
      console.error("[createGlobalPlant] Failed to load PlantGenus:", generaError);
      return new Response(
        JSON.stringify({ error: "Failed to load PlantGenus" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const normalize = (s: string | null | undefined) => (s || "").toLowerCase().trim();

    let genus = (allGenera || []).find((g: any) =>
      normalize(g.genus_name) === normalize(plant.genus_name) ||
      normalize(g.scientific_genus) === normalize(plant.scientific_genus),
    );

    if (!genus) {
      const categoryGenera = (allGenera || []).filter((g: any) =>
        g.category === plant.category ||
        (plant.category === "Blumen" && g.category === "Blumen & Kräuter"),
      );

      const nextCategoryDexNumber = categoryGenera.length + 1;

      const { data: insertedGenus, error: insertGenusError } = await adminClient
        .from("PlantGenus")
        .insert({
          id: generateLegacyHexId(),
          category_dex_number: nextCategoryDexNumber,
          genus_name: plant.genus_name,
          scientific_genus: plant.scientific_genus,
          category: plant.category,
          family: plant.family,
          description: `Gattung der ${plant.category}`,
        })
        .select("*")
        .single();

      if (insertGenusError || !insertedGenus) {
        console.error("[createGlobalPlant] Failed to insert PlantGenus:", insertGenusError);
        return new Response(
          JSON.stringify({ error: "Failed to insert PlantGenus" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
        );
      }

      genus = insertedGenus;
    }

    // 2) Pflanze in Plant anlegen
    const displayName = plant.species_name;

    const { data: insertedPlant, error: insertPlantError } = await adminClient
      .from("Plant")
      .insert({
        id: generateLegacyHexId(),
        genus_category: genus.category,
        genus_number: genus.category_dex_number,
        species_name: displayName,
        scientific_name: plant.scientific_name || null,
        description: plant.description || null,
        identification_features: plant.identification_features || null,
        fun_fact: plant.fun_fact || null,
        rarity: plant.rarity || "Gelegentlich",
      })
      .select("*")
      .single();

    if (insertPlantError || !insertedPlant) {
      console.error("[createGlobalPlant] Failed to insert Plant:", insertPlantError);
      return new Response(
        JSON.stringify({ error: "Failed to insert Plant" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // 3) Discovery für diesen User anlegen
    const { data: insertedDiscovery, error: insertDiscoveryError } = await adminClient
      .from("UserPlantDiscovery")
      .insert({
        auth_id: authId,
        created_by_id: authId,
        created_by: userEmail,
        plant_id: insertedPlant.id,
        discovered_date: new Date().toISOString(),
        discovery_location: discovery_location || null,
        discovery_notes: "",
        image_url: image_url || null,
      })
      .select("id")
      .single();

    if (insertDiscoveryError || !insertedDiscovery) {
      console.error("[createGlobalPlant] Failed to insert UserPlantDiscovery:", insertDiscoveryError);
      return new Response(
        JSON.stringify({ error: "Failed to insert UserPlantDiscovery" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    console.log("[createGlobalPlant] Successfully created Plant and UserPlantDiscovery");

    return new Response(
      JSON.stringify({
        newPlant: insertedPlant,
        newDiscoveryId: insertedDiscovery.id,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error) {
    console.error("[createGlobalPlant] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
});
