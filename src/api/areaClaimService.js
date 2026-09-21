import { supabase } from "@/api/supabaseClient";

const getCurrentAuthId = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;

  const authId = data?.user?.id;
  if (!authId) {
    throw new Error("Authenticated user is required");
  }

  return authId;
};

export const getAreaClaims = async ({ latitude, longitude, radiusM = 1500 }) => {
  const authId = await getCurrentAuthId();

  const { data, error } = await supabase.functions.invoke("getAreaClaims", {
    body: {
      authId,
      latitude,
      longitude,
      radiusM,
    },
  });

  if (error) {
    throw error;
  }

  if (!data?.success) {
    throw new Error(data?.error || "Areal-Ansprueche konnten nicht geladen werden.");
  }

  return Array.isArray(data.claims) ? data.claims : [];
};

export const renameAreaClaimGroupName = async ({ areaX, areaY, groupName }) => {
  const authId = await getCurrentAuthId();

  const { data, error } = await supabase.functions.invoke("renameAreaClaimGroup", {
    body: {
      authId,
      areaX,
      areaY,
      groupName,
    },
  });

  if (error) {
    let resolvedMessage = error.message || "Arealname konnte nicht gespeichert werden.";

    try {
      const details = await error.context?.json?.();
      if (details?.error) {
        resolvedMessage = String(details.error);
      }
    } catch {
      // Keep fallback message from error object.
    }

    throw new Error(resolvedMessage);
  }

  if (!data?.success) {
    throw new Error(data?.error || "Arealname konnte nicht gespeichert werden.");
  }

  return data;
};
