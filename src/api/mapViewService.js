import { Query } from "@/api/entities";
import { getCurrentAuthUser } from "@/api/authService";

const MAP_VIEW_COOLDOWN_MS = 30 * 1000;
const LAST_MAP_VIEW_KEY = "kpi.lastMapViewTrackTs";

const getNow = () => Date.now();

const canTrackMapView = () => {
  try {
    const raw = localStorage.getItem(LAST_MAP_VIEW_KEY);
    const previousTs = Number(raw || 0);
    if (!Number.isFinite(previousTs)) return true;
    return getNow() - previousTs >= MAP_VIEW_COOLDOWN_MS;
  } catch {
    return true;
  }
};

const markMapViewTracked = () => {
  try {
    localStorage.setItem(LAST_MAP_VIEW_KEY, String(getNow()));
  } catch {
    // localStorage may be unavailable; tracking still proceeds best-effort.
  }
};

export async function recordMapView({ source = "home_map" } = {}) {
  const authUser = await getCurrentAuthUser();
  const authId = authUser?.id || null;
  if (!authId) return { tracked: false, reason: "missing-auth" };
  if (!canTrackMapView()) return { tracked: false, reason: "cooldown" };

  const payload = {
    auth_id: authId,
    source,
    created_date: new Date().toISOString(),
  };

  try {
    await Query.MapViewEvent.create(payload);
    markMapViewTracked();
    return { tracked: true };
  } catch (error) {
    console.warn("[mapViewService] Failed to track map view", error?.message || error);
    return { tracked: false, reason: "insert-failed" };
  }
}
