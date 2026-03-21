import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

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

function buildPushPayload(params: {
  title: string;
  message: string;
  notificationType: string;
  actionUrl: string;
  actorEmail: string;
}) {
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    let actorEmail = "system";

    if (!allowUnauthenticated) {
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
        action_url: body.actionUrl || "",
        priority: body.priority || "medium",
        display_location: body.displayLocation || "banner",
        seen: false,
        created_by: actorEmail,
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
    let pushStatus: { attempted: boolean; sent: boolean; reason?: string } = {
      attempted: false,
      sent: false,
    };

    if ((targetEmail || targetAuthId) && pushPublicKey && pushPrivateKey) {
      try {
        pushStatus.attempted = true;
        let targetProfile: { id: string; push_subscription: string | null } | null = null;

        if (targetAuthId) {
          const { data: byAuthId } = await adminClient
            .from("PublicProfile")
            .select("id, push_subscription")
            .eq("auth_id", targetAuthId)
            .maybeSingle();
          targetProfile = byAuthId || null;
        }

        if (!targetProfile && targetEmail) {
          const { data: byEmail } = await adminClient
            .from("PublicProfile")
            .select("id, push_subscription")
            .ilike("user_email", targetEmail)
            .maybeSingle();
          targetProfile = byEmail || null;
        }

        if (targetProfile?.push_subscription) {
          webpush.setVapidDetails(
            "mailto:noreply@floralog.app",
            pushPublicKey,
            pushPrivateKey,
          );

          const pushPayload = buildPushPayload({
            title,
            message,
            notificationType,
            actionUrl: body.actionUrl || "",
            actorEmail,
          });

          await webpush.sendNotification(
            JSON.parse(targetProfile.push_subscription),
            JSON.stringify(pushPayload),
          );

          pushStatus.sent = true;
        } else {
          pushStatus.reason = "no_push_subscription";
          console.info("[createNotification] Push skipped: no subscription", {
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
      pushStatus.reason = "missing_target_or_vapid_keys";
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
