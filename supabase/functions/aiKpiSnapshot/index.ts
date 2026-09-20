import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSupabaseSecretKey } from "../_shared/supabaseKeys.ts";

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

function getFiveMinuteBucket(now = new Date()): string {
  const bucketMs = Math.floor(now.getTime() / (5 * 60 * 1000)) * 5 * 60 * 1000;
  return new Date(bucketMs).toISOString();
}

Deno.serve(async (req) => {
  if (req.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const expectedSecret = Deno.env.get("AI_KPI_SECRET")?.trim() || "";
  const providedSecret = req.headers.get("x-floralog-ai-secret")?.trim() || "";
  if (!expectedSecret || !providedSecret || !(await secretsMatch(providedSecret, expectedSecret))) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const secretKey = getSupabaseSecretKey();
  if (!supabaseUrl || !secretKey) {
    return jsonResponse({ error: "Service not configured" }, 500);
  }

  const adminClient = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const requestBucket = getFiveMinuteBucket();
  const { error: rateLimitError } = await adminClient
    .from("AiKpiSnapshotRequest")
    .insert({ request_bucket: requestBucket });

  if (rateLimitError?.code === "23505") {
    return jsonResponse({ error: "Rate limit exceeded" }, 429);
  }
  if (rateLimitError) {
    console.error("[aiKpiSnapshot] Audit insert failed", {
      code: rateLimitError.code,
      message: rateLimitError.message,
    });
    return jsonResponse({ error: "KPI snapshot unavailable" }, 503);
  }

  const { data, error } = await adminClient.rpc("ai_get_kpi_snapshot_v2");
  if (error || !data) {
    console.error("[aiKpiSnapshot] Aggregate query failed", {
      code: error?.code,
      message: error?.message,
    });
    return jsonResponse({ error: "KPI snapshot unavailable" }, 503);
  }

  console.log("[aiKpiSnapshot] Aggregate snapshot generated", { requestBucket });
  return jsonResponse(data);
});
