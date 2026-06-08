import { supabase } from "@/api/supabaseClient";

async function invokeFriendService(body, fallbackMessage) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Session abgelaufen. Bitte melde dich erneut an.");
  }

  const { data, error } = await supabase.functions.invoke("friendService", {
    body,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) {
    let detailedMessage = fallbackMessage;

    try {
      const responsePayload = await error.context?.json?.();
      if (responsePayload?.error) {
        detailedMessage = responsePayload.error;
      }
    } catch (_parseError) {
      // Ignore response parse errors and fall back to generic message
    }

    throw new Error(error.message === "Edge Function returned a non-2xx status code" ? detailedMessage : (error.message || detailedMessage));
  }

  if (!data?.success) {
    throw new Error(data?.error || fallbackMessage);
  }

  return data;
}

export async function sendFriendRequest(recipientEmail, recipientAuthId = null) {
  const normalizedEmail = recipientEmail?.trim?.();
  const normalizedAuthId = String(recipientAuthId || "").trim() || null;

  if (!normalizedEmail && !normalizedAuthId) {
    throw new Error("Bitte gib eine E-Mail-Adresse oder eine gültige Nutzer-ID ein.");
  }

  const data = await invokeFriendService(
    {
      action: "sendRequest",
      recipientEmail: normalizedEmail || null,
      recipientAuthId: normalizedAuthId,
    },
    "Freundschaftsanfrage konnte nicht gesendet werden.",
  );

  return data.friend;
}

export async function connectViaReferral(referrerEmail) {
  const normalizedEmail = referrerEmail?.trim?.();
  if (!normalizedEmail) {
    throw new Error("Referrer E-Mail fehlt.");
  }

  const data = await invokeFriendService(
    {
      action: "connectViaReferral",
      referrerEmail: normalizedEmail,
    },
    "Referral-Verknüpfung konnte nicht erstellt werden.",
  );

  return data;
}

export async function removeFriendship(friendEmail, friendAuthId = null) {
  const normalizedEmail = friendEmail?.trim?.();
  const normalizedAuthId = String(friendAuthId || "").trim() || null;

  if (!normalizedEmail && !normalizedAuthId) {
    throw new Error("Freund konnte nicht entfernt werden (fehlende E-Mail/ID).");
  }

  const data = await invokeFriendService(
    {
      action: "removeFriendship",
      friendEmail: normalizedEmail || null,
      friendAuthId: normalizedAuthId,
    },
    "Freund konnte nicht entfernt werden.",
  );

  return data.removed || 0;
}

export async function respondToFriendRequest(requesterEmail, action, requesterAuthId = null) {
  const normalizedEmail = requesterEmail?.trim?.();
  const normalizedAuthId = String(requesterAuthId || "").trim() || null;

  if (!normalizedEmail && !normalizedAuthId) {
    throw new Error("Anfrage kann nicht verarbeitet werden (fehlende E-Mail/ID).");
  }

  if (action !== "accept" && action !== "reject") {
    throw new Error("Ungültige Aktion für Freundschaftsanfrage.");
  }

  const data = await invokeFriendService(
    {
      action: "respondToRequest",
      requesterEmail: normalizedEmail || null,
      requesterAuthId: normalizedAuthId,
      responseAction: action,
    },
    "Freundschaftsanfrage konnte nicht verarbeitet werden.",
  );

  return data.affected || 0;
}
