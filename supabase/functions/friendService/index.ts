import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildOriginDeniedResponse } from "../_shared/origin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type FriendServiceBody =
  | {
      action?: "sendRequest";
      recipientEmail?: string | null;
    }
  | {
      action?: "sendPartnerRequest";
      recipientEmail?: string | null;
    }
  | {
      action?: "removeFriendship";
      friendEmail?: string | null;
    }
  | {
      action?: "respondToRequest";
      requesterEmail?: string | null;
      responseAction?: "accept" | "reject" | null;
    }
  | {
      action?: "respondToPartnerRequest";
      requesterEmail?: string | null;
      responseAction?: "accept" | "reject" | null;
    }
  | {
      action?: "connectViaReferral";
      referrerEmail?: string | null;
    };

function generateLegacyHexId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function getAccessTokenFromAuthHeader(header: string | null): string | null {
  if (!header) return null;
  const parts = header.split(" ");
  if (parts.length === 2 && parts[0] === "Bearer") return parts[1];
  return header;
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const originDeniedResponse = buildOriginDeniedResponse(req, corsHeaders, "friendService");
  if (originDeniedResponse) {
    return originDeniedResponse;
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Supabase service not configured" }, 500);
    }

    const accessToken = getAccessTokenFromAuthHeader(req.headers.get("Authorization"));
    if (!accessToken) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Internal auth check (required because gateway JWT verification may be disabled)
    const { data: authData, error: authError } = await adminClient.auth.getUser(accessToken);
    if (authError || !authData?.user?.email) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const actorEmail = authData.user.email.trim();
    const body = (await req.json()) as FriendServiceBody;
    const action = body?.action;

    if (action === "sendRequest") {
      const recipientEmail = body?.recipientEmail?.trim();
      if (!recipientEmail) {
        return jsonResponse({ error: "recipientEmail is required" }, 400);
      }

      if (actorEmail.toLowerCase() === recipientEmail.toLowerCase()) {
        return jsonResponse({ error: "Du kannst dir nicht selbst eine Anfrage senden!" }, 400);
      }

      const { data: forward, error: forwardError } = await adminClient
        .from("Friend")
        .select("id, status, request_sent_by, request_sent_to")
        .ilike("request_sent_by", actorEmail)
        .ilike("request_sent_to", recipientEmail)
        .limit(1)
        .maybeSingle();

      if (forwardError) {
        return jsonResponse({ error: forwardError.message }, 500);
      }

      const { data: reverse, error: reverseError } = await adminClient
        .from("Friend")
        .select("id, status, request_sent_by, request_sent_to")
        .ilike("request_sent_by", recipientEmail)
        .ilike("request_sent_to", actorEmail)
        .limit(1)
        .maybeSingle();

      if (reverseError) {
        return jsonResponse({ error: reverseError.message }, 500);
      }

      const existing = forward || reverse;
      if (existing) {
        if (existing.status === "accepted") {
          return jsonResponse({ error: "Ihr seid bereits befreundet!" }, 409);
        }

        if ((existing.request_sent_by || "").toLowerCase() === actorEmail.toLowerCase()) {
          return jsonResponse({ error: "Du hast dieser Person bereits eine Anfrage gesendet!" }, 409);
        }

        return jsonResponse({ error: "Diese Person hat dir bereits eine Anfrage gesendet!" }, 409);
      }

      const { data: createdFriend, error: createError } = await adminClient
        .from("Friend")
        .insert({
          id: generateLegacyHexId(),
          request_sent_by: actorEmail,
          request_sent_to: recipientEmail,
          status: "pending",
          created_by: actorEmail,
          auth_id: authData.user.id,
        })
        .select("*")
        .single();

      if (createError) {
        if (createError.code === "23505") {
          return jsonResponse({ error: "Freundschaftsanfrage existiert bereits." }, 409);
        }

        return jsonResponse(
          {
            error: createError.message,
            code: createError.code,
            details: createError.details,
            hint: createError.hint,
          },
          500,
        );
      }

      return jsonResponse({ success: true, friend: createdFriend }, 200);
    }

    if (action === "sendPartnerRequest") {
      const recipientEmail = body?.recipientEmail?.trim();
      if (!recipientEmail) {
        return jsonResponse({ error: "recipientEmail is required" }, 400);
      }

      if (actorEmail.toLowerCase() === recipientEmail.toLowerCase()) {
        return jsonResponse({ error: "Du kannst dir nicht selbst eine Partner-Anfrage senden!" }, 400);
      }

      const { data: forward, error: forwardError } = await adminClient
        .from("Friend")
        .select("id, status, request_sent_by, request_sent_to")
        .ilike("request_sent_by", actorEmail)
        .ilike("request_sent_to", recipientEmail)
        .limit(1)
        .maybeSingle();

      if (forwardError) {
        return jsonResponse({ error: forwardError.message }, 500);
      }

      const { data: reverse, error: reverseError } = await adminClient
        .from("Friend")
        .select("id, status, request_sent_by, request_sent_to")
        .ilike("request_sent_by", recipientEmail)
        .ilike("request_sent_to", actorEmail)
        .limit(1)
        .maybeSingle();

      if (reverseError) {
        return jsonResponse({ error: reverseError.message }, 500);
      }

      const existing = forward || reverse;
      if (existing) {
        const normalizedStatus = String(existing.status || "").trim().toLowerCase();
        if (normalizedStatus === "partner") {
          return jsonResponse({ error: "Ihr seid bereits Partner." }, 409);
        }

        return jsonResponse({ error: "Es gibt bereits eine offene Beziehung zu dieser Person." }, 409);
      }

      const { data: createdFriend, error: createError } = await adminClient
        .from("Friend")
        .insert({
          id: generateLegacyHexId(),
          request_sent_by: actorEmail,
          request_sent_to: recipientEmail,
          status: "partner_pending",
          created_by: actorEmail,
          auth_id: authData.user.id,
        })
        .select("*")
        .single();

      if (createError) {
        if (createError.code === "23505") {
          return jsonResponse({ error: "Partner-Anfrage existiert bereits." }, 409);
        }

        return jsonResponse(
          {
            error: createError.message,
            code: createError.code,
            details: createError.details,
            hint: createError.hint,
          },
          500,
        );
      }

      return jsonResponse({ success: true, friend: createdFriend }, 200);
    }

    if (action === "connectViaReferral") {
      const referrerEmail = body?.referrerEmail?.trim();
      if (!referrerEmail) {
        return jsonResponse({ error: "referrerEmail is required" }, 400);
      }

      if (actorEmail.toLowerCase() === referrerEmail.toLowerCase()) {
        return jsonResponse({ error: "Self-referral is not allowed." }, 400);
      }

      const now = new Date().toISOString();

      const { data: existingReferral, error: existingReferralError } = await adminClient
        .from("Referral")
        .select("id, status")
        .ilike("referrer_email", referrerEmail)
        .ilike("referred_email", actorEmail)
        .limit(1)
        .maybeSingle();

      if (existingReferralError) {
        return jsonResponse(
          {
            error: existingReferralError.message,
            code: existingReferralError.code,
            details: existingReferralError.details,
            hint: existingReferralError.hint,
          },
          500,
        );
      }

      if (existingReferral) {
        const { error: referralUpdateError } = await adminClient
          .from("Referral")
          .update({
            status: "completed",
            completed_date: now,
            updated_date: now,
            created_by: existingReferral.status ? undefined : referrerEmail,
            auth_id: authData.user.id,
          })
          .eq("id", existingReferral.id);

        if (referralUpdateError) {
          return jsonResponse(
            {
              error: referralUpdateError.message,
              code: referralUpdateError.code,
              details: referralUpdateError.details,
              hint: referralUpdateError.hint,
            },
            500,
          );
        }
      } else {
        const { error: referralInsertError } = await adminClient
          .from("Referral")
          .insert({
            id: generateLegacyHexId(),
            referrer_email: referrerEmail,
            referred_email: actorEmail,
            status: "completed",
            completed_date: now,
            created_date: now,
            updated_date: now,
            created_by: referrerEmail,
            auth_id: authData.user.id,
          });

        if (referralInsertError) {
          return jsonResponse(
            {
              error: referralInsertError.message,
              code: referralInsertError.code,
              details: referralInsertError.details,
              hint: referralInsertError.hint,
            },
            500,
          );
        }
      }

      const [forwardRes, reverseRes] = await Promise.all([
        adminClient
          .from("Friend")
          .select("id, status")
          .ilike("request_sent_by", actorEmail)
          .ilike("request_sent_to", referrerEmail)
          .limit(1)
          .maybeSingle(),
        adminClient
          .from("Friend")
          .select("id, status")
          .ilike("request_sent_by", referrerEmail)
          .ilike("request_sent_to", actorEmail)
          .limit(1)
          .maybeSingle(),
      ]);

      if (forwardRes.error || reverseRes.error) {
        const firstError = forwardRes.error || reverseRes.error;
        return jsonResponse(
          {
            error: firstError?.message || "Friendship lookup failed",
            code: firstError?.code,
            details: firstError?.details,
            hint: firstError?.hint,
          },
          500,
        );
      }

      const existingFriend = forwardRes.data || reverseRes.data;

      if (existingFriend) {
        const normalizedStatus = String(existingFriend.status || "").trim().toLowerCase();
        if (normalizedStatus !== "accepted" && normalizedStatus !== "partner" && normalizedStatus !== "partner_pending") {
          const { error: acceptError } = await adminClient
            .from("Friend")
            .update({ status: "accepted", added_date: now })
            .eq("id", existingFriend.id);

          if (acceptError) {
            return jsonResponse(
              {
                error: acceptError.message,
                code: acceptError.code,
                details: acceptError.details,
                hint: acceptError.hint,
              },
              500,
            );
          }
        }

        return jsonResponse({ success: true, connected: true, alreadyExisted: true }, 200);
      }

      const { error: friendInsertError } = await adminClient
        .from("Friend")
        .insert({
          id: generateLegacyHexId(),
          request_sent_by: referrerEmail,
          request_sent_to: actorEmail,
          status: "accepted",
          added_date: now,
          created_by: referrerEmail,
          auth_id: authData.user.id,
        });

      if (friendInsertError) {
        return jsonResponse(
          {
            error: friendInsertError.message,
            code: friendInsertError.code,
            details: friendInsertError.details,
            hint: friendInsertError.hint,
          },
          500,
        );
      }

      return jsonResponse({ success: true, connected: true, alreadyExisted: false }, 200);
    }

    if (action === "removeFriendship") {
      const friendEmail = body?.friendEmail?.trim();
      if (!friendEmail) {
        return jsonResponse({ error: "friendEmail is required" }, 400);
      }

      const [forwardRes, reverseRes] = await Promise.all([
        adminClient
          .from("Friend")
          .select("id")
          .ilike("request_sent_by", actorEmail)
          .ilike("request_sent_to", friendEmail),
        adminClient
          .from("Friend")
          .select("id")
          .ilike("request_sent_by", friendEmail)
          .ilike("request_sent_to", actorEmail),
      ]);

      if (forwardRes.error || reverseRes.error) {
        const firstError = forwardRes.error || reverseRes.error;
        return jsonResponse(
          {
            error: firstError?.message || "Friendship lookup failed",
            code: firstError?.code,
            details: firstError?.details,
            hint: firstError?.hint,
          },
          500,
        );
      }

      const ids = [...(forwardRes.data || []), ...(reverseRes.data || [])]
        .map((row) => row.id)
        .filter(Boolean);

      if (ids.length === 0) {
        return jsonResponse({ success: true, removed: 0 }, 200);
      }

      const { error: deleteError } = await adminClient
        .from("Friend")
        .delete()
        .in("id", ids);

      if (deleteError) {
        return jsonResponse(
          {
            error: deleteError.message,
            code: deleteError.code,
            details: deleteError.details,
            hint: deleteError.hint,
          },
          500,
        );
      }

      return jsonResponse({ success: true, removed: ids.length }, 200);
    }

    if (action === "respondToRequest") {
      const requesterEmail = body?.requesterEmail?.trim();
      const responseAction = body?.responseAction;

      if (!requesterEmail) {
        return jsonResponse({ error: "requesterEmail is required" }, 400);
      }

      if (responseAction !== "accept" && responseAction !== "reject") {
        return jsonResponse({ error: "responseAction must be 'accept' or 'reject'" }, 400);
      }

      const { data: requests, error: requestError } = await adminClient
        .from("Friend")
        .select("id")
        .ilike("request_sent_by", requesterEmail)
        .ilike("request_sent_to", actorEmail)
        .eq("status", "pending");

      if (requestError) {
        return jsonResponse(
          {
            error: requestError.message,
            code: requestError.code,
            details: requestError.details,
            hint: requestError.hint,
          },
          500,
        );
      }

      const pendingIds = (requests || []).map((row) => row.id).filter(Boolean);
      if (pendingIds.length === 0) {
        return jsonResponse({ success: true, affected: 0 }, 200);
      }

      if (responseAction === "accept") {
        const { data: updatedRows, error: updateError } = await adminClient
          .from("Friend")
          .update({
            status: "accepted",
            added_date: new Date().toISOString(),
          })
          .in("id", pendingIds)
          .select("id, status, request_sent_by, request_sent_to, added_date");

        if (updateError) {
          return jsonResponse(
            {
              error: updateError.message,
              code: updateError.code,
              details: updateError.details,
              hint: updateError.hint,
            },
            500,
          );
        }

        return jsonResponse({ success: true, affected: updatedRows?.length || 0, rows: updatedRows || [] }, 200);
      }

      const { error: deleteError } = await adminClient
        .from("Friend")
        .delete()
        .in("id", pendingIds);

      if (deleteError) {
        return jsonResponse(
          {
            error: deleteError.message,
            code: deleteError.code,
            details: deleteError.details,
            hint: deleteError.hint,
          },
          500,
        );
      }

      return jsonResponse({ success: true, affected: pendingIds.length }, 200);
    }

    if (action === "respondToPartnerRequest") {
      const requesterEmail = body?.requesterEmail?.trim();
      const responseAction = body?.responseAction;

      if (!requesterEmail) {
        return jsonResponse({ error: "requesterEmail is required" }, 400);
      }

      if (responseAction !== "accept" && responseAction !== "reject") {
        return jsonResponse({ error: "responseAction must be 'accept' or 'reject'" }, 400);
      }

      const { data: requests, error: requestError } = await adminClient
        .from("Friend")
        .select("id")
        .ilike("request_sent_by", requesterEmail)
        .ilike("request_sent_to", actorEmail)
        .eq("status", "partner_pending");

      if (requestError) {
        return jsonResponse(
          {
            error: requestError.message,
            code: requestError.code,
            details: requestError.details,
            hint: requestError.hint,
          },
          500,
        );
      }

      const pendingIds = (requests || []).map((row) => row.id).filter(Boolean);
      if (pendingIds.length === 0) {
        return jsonResponse({ success: true, affected: 0 }, 200);
      }

      if (responseAction === "accept") {
        const { data: updatedRows, error: updateError } = await adminClient
          .from("Friend")
          .update({
            status: "partner",
            added_date: new Date().toISOString(),
          })
          .in("id", pendingIds)
          .select("id, status, request_sent_by, request_sent_to, added_date");

        if (updateError) {
          return jsonResponse(
            {
              error: updateError.message,
              code: updateError.code,
              details: updateError.details,
              hint: updateError.hint,
            },
            500,
          );
        }

        return jsonResponse({ success: true, affected: updatedRows?.length || 0, rows: updatedRows || [] }, 200);
      }

      const { error: deleteError } = await adminClient
        .from("Friend")
        .delete()
        .in("id", pendingIds);

      if (deleteError) {
        return jsonResponse(
          {
            error: deleteError.message,
            code: deleteError.code,
            details: deleteError.details,
            hint: deleteError.hint,
          },
          500,
        );
      }

      return jsonResponse({ success: true, affected: pendingIds.length }, 200);
    }

    return jsonResponse({ error: "Unsupported action" }, 400);
  } catch (error) {
    return jsonResponse({ error: String(error) }, 500);
  }
});
