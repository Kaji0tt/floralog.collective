import { supabase } from "@/api/supabaseClient";

export async function deleteMyAccount(password) {
  if (!password || !password.trim()) {
    throw new Error("Bitte gib dein Passwort ein.");
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Session abgelaufen. Bitte melde dich erneut an.");
  }

  const { data, error } = await supabase.functions.invoke("deleteAccount", {
    body: {
      password,
    },
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) {
    let detailedMessage = "Konto konnte nicht gelöscht werden.";

    try {
      const responsePayload = await error.context?.json?.();
      if (responsePayload?.error) {
        detailedMessage = responsePayload.error;
      }
    } catch (_parseError) {
      // Ignore parse errors and keep fallback message.
    }

    throw new Error(
      error.message === "Edge Function returned a non-2xx status code"
        ? detailedMessage
        : (error.message || detailedMessage)
    );
  }

  if (!data?.success) {
    throw new Error(data?.error || "Konto konnte nicht gelöscht werden.");
  }

  return data;
}
