import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildOriginDeniedResponse } from "../_shared/origin.ts";
import { computeRarityLabel } from "../_shared/plantRarityLevels.ts";
import { guestReward } from "../_shared/scanReward.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
class RequestError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
type Candidate = {
  [key: string]: unknown;
  scientific_name: string;
  species_name: string;
  scientific_genus?: string;
  gbif_id?: number;
  rarity?: string | null;
  inDatabase?: boolean;
  metadata_failed?: boolean;
  is_european?: boolean;
};
const digest = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))), (byte) => byte.toString(16).padStart(2, "0")).join("");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const denied = buildOriginDeniedResponse(req, cors, "guestScan");
  if (denied) return denied;
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const secret = Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !secret) throw new Error("Guest scan service is not configured");
    const admin = createClient(url, secret, { auth: { persistSession: false } });
    const body = await req.json();
    const action = body.action;
    const takeRate = async (key: string, limit: number) => {
      const { data, error } = await admin.rpc("guest_scan_take_rate", { p_key: key, p_limit: limit });
      if (error) throw error;
      if (!data) throw new RequestError("Das Gast-Scan-Limit ist erreicht. Bitte versuche es morgen erneut oder melde dich an.", 429);
    };
    const internal = async <T>(name: string, payload: unknown): Promise<T> => {
      const response = await fetch(`${url}/functions/v1/${name}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || secret}`, apikey: secret, "Content-Type": "application/json", "x-internal-scan": secret },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || data.error) throw new RequestError(data.error || "Die Pflanzenbestimmung ist gerade nicht verfuegbar.", response.status === 429 ? 429 : 502);
      return data;
    };

    // Also callable by a scheduled service request; never deletes claimed photos.
    const cleanup = async () => {
      const { data: expired, error } = await admin.from("guest_scan").select("id,status").lt("expires_at", new Date().toISOString()).limit(20);
      if (error) throw error;
      for (const row of expired || []) {
        for (const bucket of ["guest-scans", ...(row.status === "claimed" ? [] : ["guest-discoveries"])]) {
          const { data: objects, error: listError } = await admin.storage.from(bucket).list(row.id, { limit: 100 });
          if (listError) throw listError;
          if (objects?.length) {
            const { error: removeError } = await admin.storage.from(bucket).remove(objects.map((object) => `${row.id}/${object.name}`));
            if (removeError) throw removeError;
          }
        }
        // Keep the claimed marker to enforce one guest award per account, but
        // discard temporary recognition data and revoke the capability.
        if (row.status === "claimed") {
          const { error: clearError } = await admin.from("guest_scan").update({
            token_hash: `retired:${row.id}`, paths: [], results: [], selected_plant: null, feedback: null,
            discovery_location: null, expires_at: "infinity",
          }).eq("id", row.id);
          if (clearError) throw clearError;
        } else {
          const { error: deleteError } = await admin.from("guest_scan").delete().eq("id", row.id);
          if (deleteError) throw deleteError;
        }
      }
      const { error: rateError } = await admin.from("guest_scan_rate").delete().lt("window_start", new Date(Date.now() - 86400000 * 2).toISOString());
      if (rateError) throw rateError;
    };
    if (action === "cleanup") {
      const cleanupSecret = Deno.env.get("GUEST_SCAN_CLEANUP_SECRET");
      if (!cleanupSecret || req.headers.get("Authorization") !== `Bearer ${cleanupSecret}`) throw new RequestError("Unauthorized", 401);
      await cleanup();
      return json({ success: true });
    }
    if (action === "events") {
      const [{ data: weekly, error: weekError }, { data: monthly, error: monthError }, { data: community, error: communityError }] = await Promise.all([
        admin.from("WeeklyQuest").select("id,title,description,target_species_name,target_genus_name,quest_number").order("quest_number"),
        admin.from("MonthlyQuest").select("id,title,description,quest_number").order("quest_number"),
        admin.from("CommunityQuest").select("id,title,description,icon_emoji,current_progress,required_discoveries").eq("is_event", true).eq("is_active", true).lte("start_date", new Date().toISOString()).gte("end_date", new Date().toISOString()).order("start_date", { ascending: false }).limit(1),
      ]);
      if (weekError || monthError || communityError) throw weekError || monthError || communityError;
      return json({ events: [
        ...(community || []).map((event) => ({ id: event.id, kind: "community", highlight: true, icon: event.icon_emoji, title: event.title, description: event.description, progressCurrent: event.current_progress, progressTarget: event.required_discoveries, progressPrefix: "Community " })),
      ], weeklyQuests: weekly, monthlyQuests: monthly });
    }
    if (action === "start") {
      // Hash with a server-only salt; never store/log raw visitor IP addresses.
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
      await takeRate(`start:${await digest(`${secret}:${ip}`)}`, 3);
      await takeRate("start:global", 100);
      await cleanup();
      const token = `${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "")}`;
      const { data, error } = await admin.from("guest_scan").insert({ token_hash: await digest(token) }).select("status").single();
      if (error) throw error;
      return json({ ...data, token });
    }
    if (typeof body.token !== "string" || !/^[0-9a-f]{64}$/.test(body.token)) throw new RequestError("Der Gast-Scan konnte nicht zugeordnet werden.", 401);
    const tokenHash = await digest(body.token);
    const { data: scan, error: scanError } = await admin.from("guest_scan").select("*").eq("token_hash", tokenHash).maybeSingle();
    if (scanError) throw scanError;
    if (!scan || new Date(scan.expires_at).getTime() <= Date.now()) throw new RequestError("Dein Gast-Scan ist abgelaufen. Bitte starte einen neuen Versuch.", 410);
    await takeRate(`requests:${scan.id}`, 150);
    const signedImages = async (paths: string[]) => {
      const { data, error } = await admin.storage.from("guest-scans").createSignedUrls(paths, 3600);
      if (error || data?.some((item) => item.error)) throw error || new Error("Scan photos unavailable");
      return (data || []).map((item) => item.signedUrl);
    };
    const responseForScan = async () => ({
      status: scan.status,
      results: scan.results,
      feedback: scan.feedback,
      imageUrls: scan.paths.length ? await signedImages(scan.paths) : [],
    });
    if (action === "status") return json(await responseForScan());
    if (action === "upload") {
      const mime = body.contentType;
      if (!["image/jpeg", "image/png", "image/webp"].includes(mime) || !Number.isInteger(body.size) || body.size <= 0 || body.size > 8388608) throw new RequestError("Bitte verwende ein JPG-, PNG- oder WebP-Foto bis 8 MB.");
      if (!["open", "identified"].includes(scan.status) || scan.uploads >= 20) throw new RequestError("Dieser Gast-Scan kann keine weiteren Fotos annehmen.", 409);
      const { data: reserved, error } = await admin.from("guest_scan").update({ uploads: scan.uploads + 1 }).eq("id", scan.id).eq("uploads", scan.uploads).in("status", ["open", "identified"]).select("id").maybeSingle();
      if (error) throw error;
      if (!reserved) throw new RequestError("Ein Foto wird bereits verarbeitet. Bitte versuche es erneut.", 409);
      const extension = mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "webp";
      const path = `${scan.id}/${crypto.randomUUID()}.${extension}`;
      const { data, error: uploadError } = await admin.storage.from("guest-scans").createSignedUploadUrl(path);
      if (uploadError) throw uploadError;
      return json({ path, uploadToken: data.token });
    }
    if (action === "identify") {
      if (["confirmed", "claimed"].includes(scan.status)) return json(await responseForScan());
      const paths = body.paths;
      if (!Array.isArray(paths) || paths.length < 1 || paths.length > 5 || paths.some((path) => typeof path !== "string" || !new RegExp(`^${scan.id}/[0-9a-f-]+\\.(jpg|png|webp)$`).test(path))) throw new RequestError("Ungueltige Scan-Fotos.");
      if (scan.attempts >= 4) throw new RequestError("Alle vier Gast-Versuche sind verbraucht. Melde dich an, um weiterzuscannen.", 429);
      const leaseExpired = scan.status === "identifying" && Date.now() - new Date(scan.updated_at).getTime() > 180000;
      if (!["open", "identified"].includes(scan.status) && !leaseExpired) throw new RequestError("Dein Scan wird bereits verarbeitet.", 409);
      await takeRate("identify:global", 200);
      const { data: lease, error } = await admin.from("guest_scan").update({ status: "identifying", attempts: scan.attempts + 1, updated_at: new Date().toISOString() }).eq("id", scan.id).eq("status", scan.status).eq("attempts", scan.attempts).select("id").maybeSingle();
      if (error) throw error;
      if (!lease) throw new RequestError("Dein Scan wird bereits verarbeitet.", 409);
      try {
        for (const path of paths) {
          const { data: photo, error: photoError } = await admin.storage.from("guest-scans").download(path);
          if (photoError || !photo) throw photoError || new RequestError("Foto fehlt.");
          const bytes = new Uint8Array(await photo.arrayBuffer());
          const isImage = (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
            || (bytes[0] === 0x89 && new TextDecoder().decode(bytes.slice(1, 4)) === "PNG")
            || (new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP");
          if (!isImage || bytes.length > 8388608) throw new RequestError("Die Datei ist kein unterstuetztes Pflanzenfoto.");
        }
        const imageUrls = await signedImages(paths);
        const identification = await internal<{ identified: boolean; results?: Candidate[] }>("identifyPlant", { image_urls: imageUrls, organs: body.organs });
        const results: Candidate[] = [];
        for (const candidate of identification.results || []) {
          const { data: existing, error: existingError } = await admin.from("Plant").select("*").ilike("scientific_name", candidate.scientific_name.replace(/[%_]/g, "\\$&")).limit(1).maybeSingle();
          if (existingError) throw existingError;
          if (existing) {
            results.push({ ...candidate, ...existing, inDatabase: true });
            continue;
          }
          const distribution = candidate.gbif_id ? await internal<{ is_european: boolean; europe_native_count: number; europe_introduced_count: number }>("checkPlantDistribution", { gbifId: candidate.gbif_id }) : null;
          if (!distribution?.is_european) {
            results.push({ ...candidate, inDatabase: false, notInDex: true, is_european: false });
            continue;
          }
          const metadata = await internal<Record<string, unknown>>("generatePlantMetadata", { species_name: candidate.species_name, scientific_name: candidate.scientific_name, language: "de" });
          results.push({
            ...candidate, ...metadata, scientific_name: candidate.scientific_name, species_name: candidate.species_name,
            rarity: computeRarityLabel(typeof metadata.red_list_population === "string" ? metadata.red_list_population : null, typeof metadata.red_list_threat === "string" ? metadata.red_list_threat : null),
            identification_features: Array.isArray(metadata.identification_features) ? metadata.identification_features.join(" ") : metadata.identification_features,
            inDatabase: false, notInDex: true, is_european: true,
            native_region: distribution.europe_native_count > 0
              ? (distribution.europe_introduced_count > 0 ? "Heimisch & eingebuergert in Europa" : "Heimisch in Europa")
              : "Eingebuergert in Europa",
          });
        }
        const location = body.location;
        const coordinates = Number.isFinite(location?.lat) && Number.isFinite(location?.lng) && Math.abs(location.lat) <= 90 && Math.abs(location.lng) <= 180 ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}` : null;
        const { data: saved, error: saveError } = await admin.from("guest_scan").update({ status: results.length ? "identified" : "open", paths, results, discovery_location: coordinates, updated_at: new Date().toISOString() }).eq("id", scan.id).eq("status", "identifying").eq("attempts", scan.attempts + 1).select("id").maybeSingle();
        if (saveError) throw saveError;
        if (!saved) throw new RequestError("Ein neuerer Scan-Versuch hat dieses Ergebnis ersetzt.", 409);
        return json({ status: results.length ? "identified" : "open", results, imageUrls, revision: scan.attempts + 1 });
      } catch (error) {
        const { error: resetError } = await admin.from("guest_scan").update({ status: "open" }).eq("id", scan.id).eq("status", "identifying").eq("attempts", scan.attempts + 1);
        if (resetError) console.error("[guestScan] Could not release identification lease:", resetError);
        throw error;
      }
    }
    if (action === "confirm") {
      if (["confirmed", "claimed"].includes(scan.status)) return json(await responseForScan());
      const selected: Candidate | undefined = Number.isInteger(body.index) ? scan.results[body.index] : undefined;
      if (body.revision !== scan.attempts) throw new RequestError("Das Ergebnis wurde inzwischen aktualisiert. Bitte scanne erneut.", 409);
      if (scan.status !== "identified" || !selected || selected.metadata_failed || (!selected.inDatabase && selected.is_european !== true)) throw new RequestError("Bitte waehle ein gueltiges Scan-Ergebnis.");
      const feedback = { type: "newDiscovery", plantName: selected.species_name, isInActiveZone: false, rewardDetails: guestReward(!selected.inDatabase, selected.rarity || null) };
      const { data: confirmed, error } = await admin.from("guest_scan").update({ status: "confirmed", selected_plant: selected, feedback, confirmed_at: new Date().toISOString() }).eq("id", scan.id).eq("status", "identified").eq("attempts", scan.attempts).select("id").maybeSingle();
      if (error) throw error;
      if (!confirmed) throw new RequestError("Das Ergebnis wurde bereits bestaetigt. Bitte kehre zu Home zurueck.", 409);
      return json({ status: "confirmed", feedback });
    }
    if (action === "claim") {
      const token = req.headers.get("Authorization")?.replace(/^Bearer /, "");
      const { data: auth, error: authError } = await admin.auth.getUser(token);
      if (authError || !auth.user) throw new RequestError("Bitte melde dich an, um deinen Fund zu sichern.", 401);
      if (scan.status === "claimed") {
        if (scan.claimed_by !== auth.user.id) throw new RequestError("Dieser Fund gehoert bereits zu einem anderen Konto.", 409);
        return json({ discoveryId: scan.discovery_id, alreadyClaimed: true });
      }
      if (scan.status !== "confirmed") throw new RequestError("Dein Scan ist noch nicht abgeschlossen.", 409);
      const imageUrls = [];
      for (const path of scan.paths) {
        const { data: photo, error } = await admin.storage.from("guest-scans").download(path);
        if (error || !photo) throw error || new Error("Photo not found");
        const { error: uploadError } = await admin.storage.from("guest-discoveries").upload(path, photo, { contentType: photo.type, upsert: true });
        if (uploadError) throw uploadError;
        imageUrls.push(admin.storage.from("guest-discoveries").getPublicUrl(path).data.publicUrl);
      }
      const { data, error } = await admin.rpc("claim_guest_scan", { p_token_hash: tokenHash, p_auth_id: auth.user.id, p_image_urls: imageUrls });
      if (error) {
        if (error.message === "This account has already claimed a guest scan") throw new RequestError("Dieses Konto hat bereits einen Gast-Fund uebernommen. Melde dich mit dem gewuenschten Konto an.", 409);
        if (error.message === "Guest scan not ready or expired") throw new RequestError("Dein Gast-Fund ist abgelaufen und kann nicht mehr uebernommen werden.", 410);
        throw error;
      }
      return json(data);
    }
    throw new RequestError("Unknown guest scan action");
  } catch (error) {
    console.error("[guestScan] Request failed:", error instanceof Error ? error.message : error);
    return json({ error: error instanceof RequestError ? error.message : "Dein Gast-Scan konnte nicht verarbeitet werden. Bitte versuche es erneut." }, error instanceof RequestError ? error.status : 500);
  }
});
