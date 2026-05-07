import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { buildOriginDeniedResponse } from "../_shared/origin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type CreateNotificationBody = {
  authId?: string | null;
  userEmail?: string | null;
  notificationType?: string | null;
  title?: string | null;
  message?: string | null;
  actionUrl?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  priority?: string | null;
  displayLocation?: string | null;
};

type PushPayload = {
  title: string;
  body: string;
  icon: string;
  badge: string;
  tag: string;
  vibrate: number[];
  data: {
    type: string;
    from: string;
    actionUrl: string;
  };
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

function isTruthy(value: string | null | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function isServiceRoleInvocation(accessToken: string | null, serviceRoleKey: string): boolean {
  if (!accessToken) return false;
  return accessToken === serviceRoleKey;
}

function buildPushPayload(params: {
  title: string;
  message: string;
  notificationType: string;
  actionUrl: string;
  actorEmail: string;
}): PushPayload {
  const { title, message, notificationType, actionUrl, actorEmail } = params;
  return {
    title,
    body: message,
    icon: "/PlantDexIcon.png",
    badge: "/PlantDexIcon.png",
    tag: `floralog-${notificationType}`,
    vibrate: [200, 100, 200],
    data: {
      type: notificationType,
      from: actorEmail,
      actionUrl: actionUrl || "/Friends?tab=news",
    },
  };
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
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
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
  if (!accessToken) {
    throw new Error("Google OAuth token response missing access_token");
  }

  return accessToken;
}

function parseFcmErrorReason(errorPayload: unknown): string | null {
  const details = (errorPayload as {
    error?: { details?: Array<{ errorCode?: string }> };
  })?.error?.details;

  if (!Array.isArray(details)) return null;

  const fcmDetail = details.find((detail) => typeof detail?.errorCode === "string");
  return fcmDetail?.errorCode || null;
}

async function sendFcmNotification(params: {
  serviceAccount: FcmServiceAccount;
  fcmToken: string;
  pushPayload: PushPayload;
}): Promise<{ ok: boolean; statusCode?: number; reason?: string; shouldClearToken?: boolean }> {
  const { serviceAccount, fcmToken, pushPayload } = params;
  const normalizedFcmToken = fcmToken.trim();

  console.log("[FCM] Fetching OAuth access token", {
    project_id: serviceAccount.project_id,
    client_email: serviceAccount.client_email,
  });
  let accessToken: string;
  try {
    accessToken = await getFcmAccessToken(serviceAccount);
    console.log("[FCM] OAuth token obtained successfully");
  } catch (tokenErr) {
    console.error("[FCM] OAuth token fetch FAILED:", String(tokenErr));
    throw tokenErr;
  }

  const tokenPreview = normalizedFcmToken.length > 20 ? normalizedFcmToken.slice(0, 20) + "..." : normalizedFcmToken;
  console.log("[FCM] Sending notification", {
    project_id: serviceAccount.project_id,
    token_preview: tokenPreview,
    title: pushPayload.title,
    type: pushPayload.data.type,
  });

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
          token: normalizedFcmToken,
          notification: {
            title: pushPayload.title,
            body: pushPayload.body,
          },
          data: {
            type: pushPayload.data.type,
            sender: pushPayload.data.from,
            actionUrl: pushPayload.data.actionUrl,
          },
          android: {
            priority: "high",
            notification: {
              icon: "ic_stat_floralog",
              color: "#3BAF61",
            },
          },
          apns: {
            payload: {
              aps: {
                sound: "default",
              },
            },
          },
        },
      }),
    },
  );

  const responseText = await response.text();
  console.log("[FCM] Response status:", response.status, "body:", responseText.slice(0, 800));

  if (response.ok) {
    return { ok: true };
  }

  const errorPayload = (() => { try { return JSON.parse(responseText); } catch { return {}; } })();
  const reason = parseFcmErrorReason(errorPayload);
  // Only clear tokens that are explicitly unregistered.
  // INVALID_ARGUMENT can also be caused by payload issues and should not
  // automatically wipe a potentially valid token.
  const shouldClearToken = reason === "UNREGISTERED";

  return {
    ok: false,
    statusCode: response.status,
    reason: reason || `http_${response.status}`,
    shouldClearToken,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const originDeniedResponse = buildOriginDeniedResponse(req, corsHeaders, "createNotification");
  if (originDeniedResponse) {
    return originDeniedResponse;
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey =
      Deno.env.get("SERVICE_ROLE_KEY") ||
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Supabase service not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const allowUnauthenticated = isTruthy(Deno.env.get("ALLOW_UNAUTHENTICATED_NOTIFICATIONS"));
    const accessToken = getAccessTokenFromAuthHeader(req.headers.get("Authorization"));
    const isInternalInvocation = isServiceRoleInvocation(accessToken, serviceRoleKey);

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    let actorEmail = "system";

    if (!allowUnauthenticated && !isInternalInvocation) {
      if (!accessToken) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const { data: userData, error: userError } = await adminClient.auth.getUser(accessToken);
      if (userError || !userData?.user) {
        console.error("[createNotification] Failed to resolve actor user:", userError);
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      actorEmail = userData.user.email || "system";
    } else if (isInternalInvocation) {
      actorEmail = "system";
      console.log("[createNotification] Internal service-role invocation detected");
    } else {
      console.warn("[createNotification] ALLOW_UNAUTHENTICATED_NOTIFICATIONS enabled. JWT auth is bypassed.");
    }

    const body = (await req.json()) as CreateNotificationBody;

    let targetAuthId = body.authId || null;
    let targetEmail = body.userEmail || null;
    const notificationType = body.notificationType || "custom";
    const title = body.title || "";
    const message = body.message || "";

    if (!title || !message) {
      return new Response(JSON.stringify({ error: "Missing required fields: title, message" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!targetAuthId && !targetEmail) {
      return new Response(JSON.stringify({ error: "Missing target: authId or userEmail required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!targetAuthId && targetEmail) {
      const { data: targetProfile } = await adminClient
        .from("PublicProfile")
        .select("auth_id")
        .ilike("user_email", targetEmail)
        .maybeSingle();

      targetAuthId = targetProfile?.auth_id || null;
    }

    if (targetAuthId && !targetEmail) {
      const { data: targetProfile } = await adminClient
        .from("PublicProfile")
        .select("user_email")
        .eq("auth_id", targetAuthId)
        .maybeSingle();

      targetEmail = targetProfile?.user_email || null;
    }

    console.log("[createNotification] Creating notification", {
      actorEmail,
      targetAuthId,
      targetEmail,
      notificationType,
      title,
      allowUnauthenticated,
    });

    const { data: notification, error: insertError } = await adminClient
      .from("UserNotification")
      .insert({
        auth_id: targetAuthId,
        user_email: targetEmail,
        notification_type: notificationType,
        title,
        message,
        description: body.description || "",
        image_url: body.imageUrl || "",
        action_url: body.actionUrl || "",
        priority: body.priority || "medium",
        display_location: body.displayLocation || "banner",
        seen: false,
        created_by: actorEmail,
        created_date: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (insertError) {
      console.error("[createNotification] Insert failed:", insertError);
      return new Response(JSON.stringify({
        error: insertError.message,
        code: insertError.code,
        details: insertError.details,
        hint: insertError.hint,
      }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const pushPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const pushPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const rawFcmJson = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON");
    const fcmServiceAccount = parseFcmServiceAccount(rawFcmJson);
    console.log("[createNotification] FCM service account:", fcmServiceAccount
      ? `OK (project_id=${fcmServiceAccount.project_id})`
      : rawFcmJson ? "PARSE FAILED – JSON present but invalid" : "MISSING – FCM_SERVICE_ACCOUNT_JSON not set");
    console.log("[createNotification] VAPID keys present:", { public: !!pushPublicKey, private: !!pushPrivateKey });
    let pushStatus: { attempted: boolean; sent: boolean; reason?: string } = {
      attempted: false,
      sent: false,
    };

    if (targetEmail || targetAuthId) {
      try {
        let targetProfile: { id: string; push_subscription: string | null; fcm_token: string | null } | null = null;

        if (targetAuthId) {
          const { data: byAuthId } = await adminClient
            .from("PublicProfile")
            .select("id, push_subscription, fcm_token")
            .eq("auth_id", targetAuthId)
            .maybeSingle();
          targetProfile = byAuthId || null;
        }

        if (!targetProfile && targetEmail) {
          const { data: byEmail } = await adminClient
            .from("PublicProfile")
            .select("id, push_subscription, fcm_token")
            .ilike("user_email", targetEmail)
            .maybeSingle();
          targetProfile = byEmail || null;
        }

        console.log("[createNotification] targetProfile lookup:", targetProfile
          ? { id: targetProfile.id, hasPushSub: !!targetProfile.push_subscription, hasFcmToken: !!targetProfile.fcm_token }
          : "NOT FOUND");

        const pushPayload = buildPushPayload({
          title,
          message,
          notificationType,
          actionUrl: body.actionUrl || "",
          actorEmail,
        });

        const hasValidWebSubscription = Boolean(
          targetProfile?.push_subscription && isLikelyWebPushSubscription(targetProfile.push_subscription),
        );
        const hasFcmToken = Boolean(targetProfile?.fcm_token);

        console.log("[createNotification] Push decision:", {
          hasValidWebSubscription,
          hasFcmToken,
          hasVapidKeys: !!(pushPublicKey && pushPrivateKey),
          hasFcmAccount: !!fcmServiceAccount,
        });

        // FCM (native app) takes priority over web-push when both are available.
        // Web-push is used as fallback when no FCM token exists.
        if (hasFcmToken) {
          if (!fcmServiceAccount) {
            pushStatus.reason = "missing_fcm_service_account";
            console.error("[createNotification] FCM token present but FCM_SERVICE_ACCOUNT_JSON is not set or invalid. Set it in Supabase Dashboard → Project Settings → Edge Functions → Secrets.");
          } else {
            pushStatus.attempted = true;
            const fcmSendResult = await sendFcmNotification({
              serviceAccount: fcmServiceAccount,
              fcmToken: targetProfile?.fcm_token || "",
              pushPayload,
            });

            if (fcmSendResult.ok) {
              pushStatus.sent = true;
              pushStatus.reason = "sent_fcm";
              console.log("[createNotification] FCM notification sent successfully");
            } else {
              pushStatus.reason = `fcm_${fcmSendResult.reason || "unknown"}`;
              console.error("[createNotification] FCM send failed:", { reason: fcmSendResult.reason, statusCode: fcmSendResult.statusCode, shouldClearToken: fcmSendResult.shouldClearToken });
              if (fcmSendResult.shouldClearToken) {
                if (targetAuthId) {
                  await adminClient
                    .from("PublicProfile")
                    .update({ fcm_token: null })
                    .eq("auth_id", targetAuthId);
                } else if (targetEmail) {
                  await adminClient
                    .from("PublicProfile")
                    .update({ fcm_token: null })
                    .ilike("user_email", targetEmail);
                }
              }
            }
          }
        } else if (hasValidWebSubscription && pushPublicKey && pushPrivateKey) {
          pushStatus.attempted = true;
          webpush.setVapidDetails(
            "mailto:noreply@floralog.app",
            pushPublicKey,
            pushPrivateKey,
          );

          await webpush.sendNotification(
            JSON.parse(targetProfile?.push_subscription || "{}"),
            JSON.stringify(pushPayload),
          );

          pushStatus.sent = true;
          pushStatus.reason = "sent_webpush";
        } else if (targetProfile?.push_subscription && !hasValidWebSubscription) {
          pushStatus.reason = "invalid_webpush_subscription_shape";
        } else if (hasValidWebSubscription && (!pushPublicKey || !pushPrivateKey)) {
          pushStatus.reason = "missing_vapid_keys";
        } else {
          pushStatus.reason = "no_push_target";
          console.info("[createNotification] Push skipped: no subscription/token", {
            targetAuthId,
            targetEmail,
          });
        }
      } catch (pushError) {
        const statusCode = (pushError as { statusCode?: number })?.statusCode;
        pushStatus.reason = `push_error_${statusCode || "unknown"}`;
        console.error("[createNotification] Push send failed:", pushError);

        if (statusCode === 404 || statusCode === 410) {
          if (targetAuthId) {
            await adminClient
              .from("PublicProfile")
              .update({ push_subscription: null })
              .eq("auth_id", targetAuthId);
          } else if (targetEmail) {
            await adminClient
              .from("PublicProfile")
              .update({ push_subscription: null })
              .ilike("user_email", targetEmail);
          }
        }
      }
    } else {
      pushStatus.reason = "missing_target";
    }

    return new Response(
      JSON.stringify({
        success: true,
        notification,
        debug: {
          actorEmail,
          targetAuthId,
          targetEmail,
          allowUnauthenticated,
          isInternalInvocation,
          pushStatus,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error) {
    console.error("[createNotification] Unexpected error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
