import { supabase } from "@/api/supabaseClient";

export async function sendFriendRequest(recipientEmail) {
  const normalizedEmail = recipientEmail?.trim?.();
  if (!normalizedEmail) {
    throw new Error("Bitte gib eine E-Mail-Adresse ein.");
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

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
    throw new Error(error.message || "Freundschaftsanfrage konnte nicht gesendet werden.");
  }

  if (!data?.success) {
    throw new Error(data?.error || "Freundschaftsanfrage konnte nicht gesendet werden.");
  }

  return data.friend;
}
