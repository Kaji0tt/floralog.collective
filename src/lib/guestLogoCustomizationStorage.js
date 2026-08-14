export const GUEST_LOGO_CUSTOMIZATION_STORAGE_KEY = "floralog:guestLogoCustomization";

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

const safeStorageRemove = (key) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage failures.
  }
};

export const readGuestLogoCustomizationDraft = () => {
  const raw = safeStorageGet(GUEST_LOGO_CUSTOMIZATION_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
};

export const persistGuestLogoCustomizationDraft = (draft) => {
  if (!draft || typeof draft !== "object") return;
  safeStorageSet(GUEST_LOGO_CUSTOMIZATION_STORAGE_KEY, JSON.stringify(draft));
};

export const clearGuestLogoCustomizationDraft = () => {
  safeStorageRemove(GUEST_LOGO_CUSTOMIZATION_STORAGE_KEY);
};
