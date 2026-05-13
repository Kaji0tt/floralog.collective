import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { buildOriginDeniedResponse } from "../_shared/origin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type BroadcastNewsBody = {
  title: string;
  text: string;
  createdBy?: string;
};

type FcmServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
  token_uri?: string;
};

function getAccessTokenFromAuthHeader(header: string | null): string | null {
  if (!header) return null;
  const parts = header.split(" ");
  if (parts.length === 2 && parts[0] === "Bearer") return parts[1];
  return header;
}

function parseFcmServiceAccount(rawJson: string | null): FcmServiceAccount | null {
  if (!rawJson) return null;
  try {
    const parsed = JSON.parse(rawJson) as FcmServiceAccount;
    if (!parsed?.project_id || !parsed?.client_email || !parsed?.private_key) return null;
    return parsed;
  } catch {
    return null;
  }
}

function isLikelyWebPushSubscription(subscriptionText: string | null | undefined): boolean {
  if (!subscriptionText) return false;
  try {
    const parsed = JSON.parse(subscriptionText) as { endpoint?: string; keys?: Record<string, string> };
    return typeof parsed?.endpoint === "string" && !!parsed?.keys;
  } catch {
    return false;
  }
}

function base64UrlEncodeBytes(input: Uint8Array): string {
  const binary = String.fromCharCode(...input);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlEncodeText(input: string): string {
  return base64UrlEncodeBytes(new TextEncoder().encode(input));
}

async function signGoogleJwt(serviceAccount: FcmServiceAccount): Promise<string> {
  const tokenUri = serviceAccount.token_uri || "https://oauth2.googleapis.com/token";
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: tokenUri,
    iat: now,
    exp: now + 3600,
  };

  const encodedHeader = base64UrlEncodeText(JSON.stringify(header));
  const encodedPayload = base64UrlEncodeText(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const normalizedPrivateKey = serviceAccount.private_key.replace(/\\n/g, "\n");
  const pem = normalizedPrivateKey
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const keyBytes = Uint8Array.from(atob(pem), (char) => char.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    cryptoKey,
    new TextEncoder().encode(signingInput),
  );

  return `${signingInput}.${base64UrlEncodeBytes(new Uint8Array(signature))}`;
}

async function getFcmAccessToken(serviceAccount: FcmServiceAccount): Promise<string> {
  const tokenUri = serviceAccount.token_uri || "https://oauth2.googleapis.com/token";
  const assertion = await signGoogleJwt(serviceAccount);

  const response = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Google OAuth token request failed (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const accessToken = (data as { access_token?: string })?.access_token;
  if (!accessToken) throw new Error("Google OAuth token response missing access_token");
  return accessToken;
}

async function sendFcmNotification(params: {
  serviceAccount: FcmServiceAccount;
  fcmToken: string;
  title: string;
  body: string;
  actionUrl: string;
}): Promise<{ ok: boolean; shouldClearToken?: boolean }> {
  const { serviceAccount, fcmToken, title, body, actionUrl } = params;

  let accessToken: string;
  try {
    accessToken = await getFcmAccessToken(serviceAccount);
  } catch {
    return { ok: false };
  }

  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        message: {
          token: fcmToken.trim(),
          notification: { title, body },
          data: {
            type: "admin_broadcast",
            sender: "system",
            actionUrl,
          },
          android: {
            priority: "high",
            notification: { icon: "ic_stat_floralog", color: "#3BAF61" },
          },
          apns: { payload: { aps: { sound: "default" } } },
        },
      }),
    },
  );

  if (response.ok) return { ok: true };

  const errText = await response.text();
  let reason: string | null = null;
  try {
    const errJson = JSON.parse(errText) as { error?: { details?: Array<{ errorCode?: string }> } };
    const details = errJson?.error?.details;
    if (Array.isArray(details)) {
      const fcmDetail = details.find((d) => typeof d?.errorCode === "string");
      reason = fcmDetail?.errorCode || null;
    }
  } catch { /* ignore */ }

  return { ok: false, shouldClearToken: reason === "UNREGISTERED" };
}

function createUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const originDeniedResponse = buildOriginDeniedResponse(req, corsHeaders, "broadcastNews");
  if (originDeniedResponse) return originDeniedResponse;

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey =
      Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Supabase service not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const accessToken = getAccessTokenFromAuthHeader(req.headers.get("Authorization"));
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Verify caller is an authenticated admin
    const { data: userData, error: userError } = await adminClient.auth.getUser(accessToken);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const actorEmail = userData.user.email || "system";

    const { data: callerProfile } = await adminClient
      .from("PublicProfile")
      .select("role")
      .eq("auth_id", userData.user.id)
      .maybeSingle();

    if (callerProfile?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden: admin role required" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const body = (await req.json()) as BroadcastNewsBody;
    const { title, text } = body;

    if (!title?.trim() || !text?.trim()) {
      return new Response(JSON.stringify({ error: "Missing required fields: title, text" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // 1. Create News entry
    const newsId = createUuid();
    const { error: newsInsertError } = await adminClient
      .from("News")
      .insert({
        id: newsId,
        title: title.trim(),
        text: text.trim(),
        created_date: new Date().toISOString(),
        created_by: actorEmail,
      });

    if (newsInsertError) {
      console.error("[broadcastNews] News insert failed:", newsInsertError);
      return new Response(JSON.stringify({ error: newsInsertError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // 2. Fetch all profiles with push subscriptions or FCM tokens
    const { data: allProfiles } = await adminClient
      .from("PublicProfile")
      .select("auth_id, user_email, push_subscription, fcm_token");

    const profiles = (allProfiles || []) as Array<{
      auth_id: string | null;
      user_email: string | null;
      push_subscription: string | null;
      fcm_token: string | null;
    }>;

    const pushPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const pushPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const rawFcmJson = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON");
    const fcmServiceAccount = parseFcmServiceAccount(rawFcmJson);

    const actionUrl = "Friends?tab=news";
    let pushSent = 0;
    let pushFailed = 0;
    const tokensToClear: string[] = [];

    // 3. Send push notifications in batches (avoid rate limiting)
    const BATCH_SIZE = 20;
    for (let i = 0; i < profiles.length; i += BATCH_SIZE) {
      const batch = profiles.slice(i, i + BATCH_SIZE);

      await Promise.allSettled(
        batch.map(async (profile) => {
          const hasFcm = Boolean(profile.fcm_token);
          const hasWebPush = isLikelyWebPushSubscription(profile.push_subscription);

          if (!hasFcm && !hasWebPush) return;

          // FCM takes priority
          if (hasFcm && fcmServiceAccount) {
            const result = await sendFcmNotification({
              serviceAccount: fcmServiceAccount,
              fcmToken: profile.fcm_token!,
              title,
              body: text.trim(),
              actionUrl,
            });
            if (result.ok) {
              pushSent++;
            } else {
              pushFailed++;
              if (result.shouldClearToken && profile.auth_id) {
                tokensToClear.push(profile.auth_id);
              }
            }
            return;
          }

          // Web push fallback
          if (hasWebPush && pushPublicKey && pushPrivateKey) {
            try {
              webpush.setVapidDetails(
                "mailto:info@floralog.de",
                pushPublicKey,
                pushPrivateKey,
              );
              const subscription = JSON.parse(profile.push_subscription!);
              const pushPayload = JSON.stringify({
                title,
                body: text.trim(),
                icon: "/PlantDexIcon.png",
                badge: "/PlantDexIcon.png",
                tag: "floralog-admin_broadcast",
                data: { type: "admin_broadcast", from: actorEmail, actionUrl },
              });
              await webpush.sendNotification(subscription, pushPayload);
              pushSent++;
            } catch {
              pushFailed++;
            }
          }
        }),
      );
    }

    // 4. Clear stale FCM tokens
    if (tokensToClear.length > 0) {
      await Promise.allSettled(
        tokensToClear.map((authId) =>
          adminClient
            .from("PublicProfile")
            .update({ fcm_token: null })
            .eq("auth_id", authId)
        ),
      );
    }

    console.log("[broadcastNews] Done", {
      newsId,
      totalProfiles: profiles.length,
      pushSent,
      pushFailed,
    });

    return new Response(
      JSON.stringify({
        success: true,
        newsId,
        totalProfiles: profiles.length,
        pushSent,
        pushFailed,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (err) {
    console.error("[broadcastNews] Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
