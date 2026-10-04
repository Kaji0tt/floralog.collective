import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSupabaseSecretKey } from "../_shared/supabaseKeys.ts";

const BUCKET = "social-media";
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_UPLOADS_PER_HOUR = 30;

const responseHeaders = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: responseHeaders });
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

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const expectedSecret = Deno.env.get("AI_KPI_SECRET")?.trim() || "";
  const providedSecret = req.headers.get("x-floralog-ai-secret")?.trim() || "";
  if (!expectedSecret || !providedSecret || !(await secretsMatch(providedSecret, expectedSecret))) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  if (req.headers.get("content-type")?.split(";")[0].trim() !== "image/jpeg") {
    return jsonResponse({ error: "Only image/jpeg is accepted" }, 415);
  }
  const declaredLength = Number(req.headers.get("content-length") || "0");
  if (declaredLength > MAX_BYTES) {
    return jsonResponse({ error: "Payload too large" }, 413);
  }

  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_BYTES) {
    return jsonResponse({ error: "Payload too large or empty" }, 413);
  }
  if (!isJpeg(bytes)) {
    return jsonResponse({ error: "Invalid JPEG" }, 415);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const secretKey = getSupabaseSecretKey();
  if (!supabaseUrl || !secretKey) {
    return jsonResponse({ error: "Service not configured" }, 500);
  }
  const adminClient = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await adminClient
    .from("AiMediaUpload")
    .select("id", { count: "exact", head: true })
    .gte("uploaded_at", oneHourAgo);
  if (countError) {
    console.error("[aiSocialMediaUpload] Rate check failed", { code: countError.code });
    return jsonResponse({ error: "Upload unavailable" }, 503);
  }
  if ((count ?? 0) >= MAX_UPLOADS_PER_HOUR) {
    return jsonResponse({ error: "Rate limit exceeded" }, 429);
  }

  const objectPath = `reach/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.jpg`;
  const { error: uploadError } = await adminClient.storage
    .from(BUCKET)
    .upload(objectPath, bytes, { contentType: "image/jpeg", upsert: false });
  if (uploadError) {
    console.error("[aiSocialMediaUpload] Upload failed", { message: uploadError.message });
    return jsonResponse({ error: "Upload failed" }, 503);
  }

  await adminClient.from("AiMediaUpload").insert({ object_path: objectPath, byte_size: bytes.length });
  const { data } = adminClient.storage.from(BUCKET).getPublicUrl(objectPath);
  console.log("[aiSocialMediaUpload] Stored", { objectPath, bytes: bytes.length });
  return jsonResponse({ url: data.publicUrl });
});
