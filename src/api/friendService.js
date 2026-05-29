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

export async function sendFriendRequest(recipientEmail) {
  const normalizedEmail = recipientEmail?.trim?.();
  if (!normalizedEmail) {
    throw new Error("Bitte gib eine E-Mail-Adresse ein.");
  }

  const data = await invokeFriendService(
    {
      action: "sendRequest",
      recipientEmail: normalizedEmail,
    },
    "Freundschaftsanfrage konnte nicht gesendet werden.",
  );

  return data.friend;
}

export async function sendPartnerRequest(partnerEmail) {
  const normalizedEmail = partnerEmail?.trim?.();
  if (!normalizedEmail) {
    throw new Error("Bitte wähle einen Partner aus.");
  }

  const data = await invokeFriendService(
    {
      action: "sendPartnerRequest",
      recipientEmail: normalizedEmail,
    },
    "Partner-Anfrage konnte nicht gesendet werden.",
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

export async function removeFriendship(friendEmail) {
  const normalizedEmail = friendEmail?.trim?.();
  if (!normalizedEmail) {
    throw new Error("Freund konnte nicht entfernt werden (fehlende E-Mail).");
  }

  const data = await invokeFriendService(
    {
      action: "removeFriendship",
      friendEmail: normalizedEmail,
    },
    "Freund konnte nicht entfernt werden.",
  );

  return data.removed || 0;
}

export async function respondToFriendRequest(requesterEmail, action) {
  const normalizedEmail = requesterEmail?.trim?.();
  if (!normalizedEmail) {
    throw new Error("Anfrage kann nicht verarbeitet werden (fehlende E-Mail).");
  }

  if (action !== "accept" && action !== "reject") {
    throw new Error("Ungültige Aktion für Freundschaftsanfrage.");
  }

  const data = await invokeFriendService(
    {
      action: "respondToRequest",
      requesterEmail: normalizedEmail,
      responseAction: action,
    },
    "Freundschaftsanfrage konnte nicht verarbeitet werden.",
  );

  return data.affected || 0;
}

export async function respondToPartnerRequest(requesterEmail, action) {
  const normalizedEmail = requesterEmail?.trim?.();
  if (!normalizedEmail) {
    throw new Error("Partner-Anfrage kann nicht verarbeitet werden (fehlende E-Mail).");
  }

  if (action !== "accept" && action !== "reject") {
    throw new Error("Ungültige Aktion für Partner-Anfrage.");
  }

  const data = await invokeFriendService(
    {
      action: "respondToPartnerRequest",
      requesterEmail: normalizedEmail,
      responseAction: action,
    },
    "Partner-Anfrage konnte nicht verarbeitet werden.",
  );

  return data.affected || 0;
}
