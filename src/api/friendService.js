import { supabase } from "@/api/supabaseClient";

export async function sendFriendRequest(recipientEmail) {
  const normalizedEmail = recipientEmail?.trim?.();
  if (!normalizedEmail) {
    throw new Error("Bitte gib eine E-Mail-Adresse ein.");
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Session abgelaufen. Bitte melde dich erneut an.");
  }

  const invokeOptions = {
    body: { recipientEmail: normalizedEmail },
  };

  if (session?.access_token) {
    invokeOptions.headers = {
      Authorization: `Bearer ${session.access_token}`,
    };
  }

  const { data, error } = await supabase.functions.invoke("sendFriendRequest", invokeOptions);

  if (error) {
    let detailedMessage = "Freundschaftsanfrage konnte nicht gesendet werden.";

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
    throw new Error(data?.error || "Freundschaftsanfrage konnte nicht gesendet werden.");
  }

  return data.friend;
}
