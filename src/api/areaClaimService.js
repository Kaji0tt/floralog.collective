import { supabase } from "@/api/supabaseClient";

const AREA_CLAIMS_TIMEOUT_MS = 12000;

const getCurrentAuthId = async (authId = null) => {
  if (authId) return authId;

  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;

  const currentAuthId = data?.user?.id;
  if (!currentAuthId) {
    throw new Error("Authenticated user is required");
  }

  return currentAuthId;
};

export const getAreaClaims = async ({ authId: providedAuthId = null, latitude, longitude, radiusM = 1500 }) => {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error("Area-Claims konnten nicht rechtzeitig geladen werden.")), AREA_CLAIMS_TIMEOUT_MS);
  });

  return Promise.race([getAreaClaimsRequest({ authId: providedAuthId, latitude, longitude, radiusM }), timeoutPromise]);
};

const getAreaClaimsRequest = async ({ authId: providedAuthId, latitude, longitude, radiusM }) => {
  const authId = await getCurrentAuthId(providedAuthId);

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
