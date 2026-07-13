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
      recipientAuthId?: string | null;
    }
  | {
      action?: "removeFriendship";
      friendEmail?: string | null;
      friendAuthId?: string | null;
    }
  | {
      action?: "respondToRequest";
      requesterEmail?: string | null;
      requesterAuthId?: string | null;
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

function normalizeEmail(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.toLowerCase() : null;
}

function normalizeAuthId(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed || null;
}

async function getPublicProfileByEmail(
  adminClient: ReturnType<typeof createClient>,
  email: string | null,
): Promise<{ auth_id: string | null; user_email: string | null } | null> {
  if (!email) return null;
  const { data, error } = await adminClient
    .from("PublicProfile")
    .select("auth_id, user_email")
    .ilike("user_email", email)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`PublicProfile lookup by email failed: ${error.message}`);
  }

  return (data || null) as { auth_id: string | null; user_email: string | null } | null;
}

async function getPublicProfileByAuthId(
  adminClient: ReturnType<typeof createClient>,
  authId: string | null,
): Promise<{ auth_id: string | null; user_email: string | null } | null> {
  if (!authId) return null;
  const { data, error } = await adminClient
    .from("PublicProfile")
    .select("auth_id, user_email")
    .eq("auth_id", authId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`PublicProfile lookup by auth_id failed: ${error.message}`);
  }

  return (data || null) as { auth_id: string | null; user_email: string | null } | null;
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

    const actorEmail = authData.user.email.trim().toLowerCase();
    const actorAuthId = authData.user.id;
    const body = (await req.json()) as FriendServiceBody;
    const action = body?.action;

    if (action === "sendRequest") {
      const recipientAuthIdInput = normalizeAuthId(body?.recipientAuthId);
      let recipientEmail = normalizeEmail(body?.recipientEmail);
      let recipientAuthId = recipientAuthIdInput;

      if (recipientAuthId && !recipientEmail) {
        const profileByAuthId = await getPublicProfileByAuthId(adminClient, recipientAuthId);
        recipientEmail = normalizeEmail(profileByAuthId?.user_email || null);
      }

      if (!recipientAuthId && recipientEmail) {
        const profileByEmail = await getPublicProfileByEmail(adminClient, recipientEmail);
        recipientAuthId = normalizeAuthId(profileByEmail?.auth_id || null);
      }

      if (!recipientEmail) {
        return jsonResponse({ error: "recipientEmail is required" }, 400);
      }

      if ((recipientAuthId && recipientAuthId === actorAuthId) || actorEmail === recipientEmail) {
        return jsonResponse({ error: "Du kannst dir nicht selbst eine Anfrage senden!" }, 400);
      }

      const lookupQueries: Array<Promise<{ data: unknown; error: unknown }>> = [];

      lookupQueries.push(
        adminClient
          .from("Friend")
          .select("id, status, request_sent_by, request_sent_to")
          .ilike("request_sent_by", actorEmail)
          .ilike("request_sent_to", recipientEmail)
          .limit(1)
          .maybeSingle(),
      );

      lookupQueries.push(
        adminClient
          .from("Friend")
          .select("id, status, request_sent_by, request_sent_to")
          .ilike("request_sent_by", recipientEmail)
          .ilike("request_sent_to", actorEmail)
          .limit(1)
          .maybeSingle(),
      );

      if (recipientAuthId) {
        lookupQueries.push(
          adminClient
            .from("Friend")
            .select("id, status, request_sent_by, request_sent_to")
            .eq("request_sent_by_auth_id", actorAuthId)
            .eq("request_sent_to_auth_id", recipientAuthId)
            .limit(1)
            .maybeSingle(),
        );
        lookupQueries.push(
          adminClient
            .from("Friend")
            .select("id, status, request_sent_by, request_sent_to")
            .eq("request_sent_by_auth_id", recipientAuthId)
            .eq("request_sent_to_auth_id", actorAuthId)
            .limit(1)
            .maybeSingle(),
        );
      }

      const lookupResults = await Promise.all(lookupQueries);
      for (const result of lookupResults) {
        if (result.error) {
          const err = result.error as { message?: string };
          return jsonResponse({ error: err.message || "Friendship lookup failed" }, 500);
        }
      }

      const existing = lookupResults.map((result) => result.data).find(Boolean) as
        | { status?: string | null; request_sent_by?: string | null }
        | undefined;
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
          request_sent_by_auth_id: actorAuthId,
          request_sent_to_auth_id: recipientAuthId,
          status: "pending",
          created_by: actorEmail,
          auth_id: actorAuthId,
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

    if (action === "connectViaReferral") {
      // Resolve the referrer from the request body (legacy localStorage path) and
      // fall back to the durable user_metadata.referred_by that was bound at signup.
      // The metadata is the robust source: it survives email confirmation,
      // device/browser switches and app installs.
      const metadataReferrer = normalizeEmail(
        (authData.user.user_metadata as Record<string, unknown> | null)?.["referred_by"] as
          | string
          | null
          | undefined,
      );
      const referrerEmail = normalizeEmail(body?.referrerEmail) || metadataReferrer;
      if (!referrerEmail) {
        // Nothing to connect (user has no referrer). Treat as a no-op success so
        // the client can call this speculatively without producing errors.
        return jsonResponse({ success: true, connected: false, reason: "no_referrer" }, 200);
      }

      if (actorEmail === referrerEmail) {
        return jsonResponse({ error: "Self-referral is not allowed." }, 400);
      }

      const referrerProfile = await getPublicProfileByEmail(adminClient, referrerEmail);
      const referrerAuthId = normalizeAuthId(referrerProfile?.auth_id || null);

      const now = new Date().toISOString();

      // Idempotency check: prefer referrer_auth_id lookup (stable across email changes).
      // Fall back to email ilike when referrerAuthId is not resolved.
      const referrerFilter = referrerAuthId
        ? `referrer_auth_id.eq.${referrerAuthId},referrer_email.ilike.${referrerEmail}`
        : `referrer_email.ilike.${referrerEmail}`;

      const { data: existingReferral, error: existingReferralError } = await adminClient
        .from("Referral")
        .select("id, status")
        .ilike("referred_email", actorEmail)
        .or(referrerFilter)
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
            ...(referrerAuthId ? { referrer_auth_id: referrerAuthId } : {}),
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
            ...(referrerAuthId ? { referrer_auth_id: referrerAuthId } : {}),
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

      const [forwardByIdRes, reverseByIdRes] = referrerAuthId
        ? await Promise.all([
          adminClient
            .from("Friend")
            .select("id, status")
            .eq("request_sent_by_auth_id", actorAuthId)
            .eq("request_sent_to_auth_id", referrerAuthId)
            .limit(1)
            .maybeSingle(),
          adminClient
            .from("Friend")
            .select("id, status")
            .eq("request_sent_by_auth_id", referrerAuthId)
            .eq("request_sent_to_auth_id", actorAuthId)
            .limit(1)
            .maybeSingle(),
        ])
        : [{ data: null, error: null }, { data: null, error: null }];

      if (forwardRes.error || reverseRes.error || forwardByIdRes.error || reverseByIdRes.error) {
        const firstError = forwardRes.error || reverseRes.error || forwardByIdRes.error || reverseByIdRes.error;
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

      const existingFriend = forwardByIdRes.data || reverseByIdRes.data || forwardRes.data || reverseRes.data;

      if (existingFriend) {
        if (existingFriend.status !== "accepted") {
          const acceptPayload: Record<string, unknown> = {
            status: "accepted",
            added_date: now,
            request_sent_to_auth_id: actorAuthId,
          };
          if (referrerAuthId) {
            acceptPayload.request_sent_by_auth_id = referrerAuthId;
          }

          const { error: acceptError } = await adminClient
            .from("Friend")
            .update(acceptPayload)
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
          request_sent_by_auth_id: referrerAuthId,
          request_sent_to_auth_id: actorAuthId,
          status: "accepted",
          added_date: now,
          created_by: referrerEmail,
          auth_id: actorAuthId,
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
      const friendEmail = normalizeEmail(body?.friendEmail);
      let friendAuthId = normalizeAuthId(body?.friendAuthId);

      if (!friendAuthId && friendEmail) {
        const friendProfile = await getPublicProfileByEmail(adminClient, friendEmail);
        friendAuthId = normalizeAuthId(friendProfile?.auth_id || null);
      }

      if (!friendEmail && !friendAuthId) {
        return jsonResponse({ error: "friendEmail or friendAuthId is required" }, 400);
      }

      const lookupQueries: Array<Promise<{ data: unknown; error: unknown }>> = [];

      if (friendEmail) {
        lookupQueries.push(
          adminClient
            .from("Friend")
            .select("id")
            .ilike("request_sent_by", actorEmail)
            .ilike("request_sent_to", friendEmail),
        );
        lookupQueries.push(
          adminClient
            .from("Friend")
            .select("id")
            .ilike("request_sent_by", friendEmail)
            .ilike("request_sent_to", actorEmail),
        );
      }

      if (friendAuthId) {
        lookupQueries.push(
          adminClient
            .from("Friend")
            .select("id")
            .eq("request_sent_by_auth_id", actorAuthId)
            .eq("request_sent_to_auth_id", friendAuthId),
        );
        lookupQueries.push(
          adminClient
            .from("Friend")
            .select("id")
            .eq("request_sent_by_auth_id", friendAuthId)
            .eq("request_sent_to_auth_id", actorAuthId),
        );
      }

      const lookupResults = await Promise.all(lookupQueries);

      if (lookupResults.some((result) => result.error)) {
        const firstError = lookupResults.find((result) => result.error)?.error as {
          message?: string;
          code?: string;
          details?: string;
          hint?: string;
        };
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

      const ids = Array.from(
        new Set(
          lookupResults
            .flatMap((result) => (result.data as Array<{ id?: string }> | null) || [])
            .map((row) => row.id)
            .filter(Boolean),
        ),
      );

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
      const requesterEmail = normalizeEmail(body?.requesterEmail);
      let requesterAuthId = normalizeAuthId(body?.requesterAuthId);
      const responseAction = body?.responseAction;

      if (!requesterEmail && !requesterAuthId) {
        return jsonResponse({ error: "requesterEmail or requesterAuthId is required" }, 400);
      }

      if (responseAction !== "accept" && responseAction !== "reject") {
        return jsonResponse({ error: "responseAction must be 'accept' or 'reject'" }, 400);
      }

      if (!requesterAuthId && requesterEmail) {
        const requesterProfile = await getPublicProfileByEmail(adminClient, requesterEmail);
        requesterAuthId = normalizeAuthId(requesterProfile?.auth_id || null);
      }

      const pendingLookupQueries: Array<Promise<{ data: unknown; error: unknown }>> = [];

      if (requesterEmail) {
        pendingLookupQueries.push(
          adminClient
            .from("Friend")
            .select("id")
            .ilike("request_sent_by", requesterEmail)
            .ilike("request_sent_to", actorEmail)
            .eq("status", "pending"),
        );
      }

      if (requesterAuthId) {
        pendingLookupQueries.push(
          adminClient
            .from("Friend")
            .select("id")
            .eq("request_sent_by_auth_id", requesterAuthId)
            .eq("request_sent_to_auth_id", actorAuthId)
            .eq("status", "pending"),
        );
      }

      const pendingLookupResults = await Promise.all(pendingLookupQueries);
      const firstPendingError = pendingLookupResults.find((result) => result.error)?.error as {
        message?: string;
        code?: string;
        details?: string;
        hint?: string;
      } | undefined;

      if (firstPendingError) {
        return jsonResponse(
          {
            error: firstPendingError.message,
            code: firstPendingError.code,
            details: firstPendingError.details,
            hint: firstPendingError.hint,
          },
          500,
        );
      }

      const pendingIds = Array.from(
        new Set(
          pendingLookupResults
            .flatMap((result) => (result.data as Array<{ id?: string }> | null) || [])
            .map((row) => row.id)
            .filter(Boolean),
        ),
      );
      if (pendingIds.length === 0) {
        return jsonResponse({ success: true, affected: 0 }, 200);
      }

      if (responseAction === "accept") {
        const acceptPayload: Record<string, unknown> = {
          status: "accepted",
          added_date: new Date().toISOString(),
          request_sent_to_auth_id: actorAuthId,
        };
        if (requesterAuthId) {
          acceptPayload.request_sent_by_auth_id = requesterAuthId;
        }

        const { data: updatedRows, error: updateError } = await adminClient
          .from("Friend")
          .update(acceptPayload)
          .in("id", pendingIds)
          .select("id, status, request_sent_by, request_sent_to, request_sent_by_auth_id, request_sent_to_auth_id, added_date");

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
