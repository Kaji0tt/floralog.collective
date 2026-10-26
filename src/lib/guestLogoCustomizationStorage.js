export const GUEST_LOGO_CUSTOMIZATION_STORAGE_KEY = "floralog:guestLogoCustomization";

const safeStorageGet = (key) => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    console.warn("[GuestLogo] Could not read local customization:", error);
    return null;
  }
};

const safeStorageSet = (key, value) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    console.warn("[GuestLogo] Could not save local customization:", error);
    window.dispatchEvent(new Event("guestLogoStorageFailed"));
  }
};

const safeStorageRemove = (key) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch (error) {
    console.warn("[GuestLogo] Could not clear local customization:", error);
  }
};

export const readGuestLogoCustomizationDraft = () => {
  const raw = safeStorageGet(GUEST_LOGO_CUSTOMIZATION_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const faces = ["face_default", "face_bug", "face_mask", "face_smile"];
    const borders = ["border_default", "border_hacked", "border_orbit", "border_triad"];
    return {
      selected_face_asset: faces.includes(parsed.selected_face_asset) ? parsed.selected_face_asset : "face_default",
      selected_border_asset: borders.includes(parsed.selected_border_asset) ? parsed.selected_border_asset : "border_default",
      selected_border_color: /^#[0-9a-f]{6}$/i.test(parsed.selected_border_color || "") ? parsed.selected_border_color : null,
    };
  } catch (error) {
    console.warn("[GuestLogo] Invalid local customization:", error);
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
