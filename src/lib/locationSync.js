const LOCATION_STORAGE_KEY = "floralog:last_location";
const LOCATION_PERMISSION_KEY = "floralog:location_permission_granted";
export const LOCATION_UPDATED_EVENT = "floralog:location-updated";
export const LOCATION_CACHE_MAX_AGE_MS = 5 * 60 * 1000;

const isBrowser = () => typeof window !== "undefined";

const toPayload = (lat, lng) => ({
  lat,
  lng,
  updatedAt: new Date().toISOString(),
});

export const getCachedLocation = ({ maxAgeMs } = {}) => {
  if (!isBrowser()) return null;

  const raw = window.localStorage.getItem(LOCATION_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!Number.isFinite(parsed?.lat) || !Number.isFinite(parsed?.lng)) {
      return null;
    }

    if (Number.isFinite(maxAgeMs)) {
      const updatedAtMs = parsed?.updatedAt ? Date.parse(parsed.updatedAt) : Number.NaN;
      if (!Number.isFinite(updatedAtMs)) {
        return null;
      }

      if (Date.now() - updatedAtMs > maxAgeMs) {
        return null;
      }
    }

    return {
      lat: parsed.lat,
      lng: parsed.lng,
      updatedAt: parsed.updatedAt || null,
    };
  } catch (_err) {
    return null;
  }
};

export const hasLocationPermissionBeenGranted = () => {
  if (!isBrowser()) return false;
  return window.localStorage.getItem(LOCATION_PERMISSION_KEY) === "true";
};

export const cacheLocation = ({ lat, lng }) => {
  if (!isBrowser() || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const payload = toPayload(lat, lng);
  window.localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(payload));
  window.localStorage.setItem(LOCATION_PERMISSION_KEY, "true");
  window.dispatchEvent(new CustomEvent(LOCATION_UPDATED_EVENT, { detail: payload }));
  return payload;
};

export const requestCurrentLocation = ({
  enableHighAccuracy = true,
  timeout = 12000,
  maximumAge = 60000,
} = {}) => {
  return new Promise((resolve, reject) => {
    if (!isBrowser() || !navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => reject(error),
      {
        enableHighAccuracy,
        timeout,
        maximumAge,
      }
    );
  });
};

export const refreshCachedLocation = async ({
  skipPrompt = true,
  force = false,
  options,
} = {}) => {
  if (!isBrowser() || !navigator.geolocation) return null;

  const hasGrantedBefore = hasLocationPermissionBeenGranted();
  if (skipPrompt && !force && !hasGrantedBefore) {
    return getCachedLocation();
  }

  if (skipPrompt && navigator.permissions?.query) {
    try {
      const result = await navigator.permissions.query({ name: "geolocation" });
      if (result.state !== "granted") {
        return getCachedLocation();
      }
    } catch (_err) {
      return getCachedLocation();
    }
  }

  try {
    const coords = await requestCurrentLocation(options);
    return cacheLocation(coords);
  } catch (error) {
    if (skipPrompt) {
      return getCachedLocation();
    }
    throw error;
  }
};
