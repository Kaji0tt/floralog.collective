import { resolveEquippedLogoAssets, resolveEquippedLogoAssetsWithCatalog } from "@/lib/logoAccessoryAssets";

export const LAST_SIGNED_IN_USER_STORAGE_KEY = "floralog:lastSignedInUser";

const safeStorageGet = (key) => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeStorageSet = (key, value) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures (private mode, quota issues, etc.)
  }
};

const normalizeDisplayName = (profile, authUser) => {
  const profileName = profile?.display_name || profile?.full_name;
  if (typeof profileName === "string" && profileName.trim()) {
    return profileName.trim();
  }

  const metadata = authUser?.user_metadata || {};
  const metadataName = metadata.display_name || metadata.full_name || metadata.name;
  if (typeof metadataName === "string" && metadataName.trim()) {
    return metadataName.trim();
  }

  if (typeof authUser?.email === "string" && authUser.email.includes("@")) {
    return authUser.email.split("@")[0];
  }

  return null;
};

const buildSnapshot = ({ authUser, profile, logoAssetsCatalog }) => {
  if (!authUser?.id) return null;

  const resolvedLogoAssets = Array.isArray(logoAssetsCatalog) && logoAssetsCatalog.length > 0
    ? resolveEquippedLogoAssetsWithCatalog(profile || {}, logoAssetsCatalog)
    : resolveEquippedLogoAssets(profile || {});

  return {
    authId: authUser.id,
    email: authUser.email || null,
    displayName: normalizeDisplayName(profile, authUser),
    logoAssets: resolvedLogoAssets,
    savedAt: new Date().toISOString(),
  };
};

export const persistLastSignedInUserSnapshot = ({ authUser, profile, logoAssetsCatalog = [] }) => {
  const snapshot = buildSnapshot({ authUser, profile, logoAssetsCatalog });
  if (!snapshot) return null;

  safeStorageSet(LAST_SIGNED_IN_USER_STORAGE_KEY, JSON.stringify(snapshot));
  return snapshot;
};

export const readLastSignedInUserSnapshot = () => {
  const raw = safeStorageGet(LAST_SIGNED_IN_USER_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
};
