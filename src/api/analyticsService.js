/**
 * analyticsService.js
 *
 * Lightweight fire-and-forget event tracker for in-app navigation and interactions.
 * All calls are silent (never throw) and include a per-event cooldown to prevent
 * duplicate events from rapid re-renders or double-clicks.
 *
 * Usage:
 *   trackAction("home_scan_click", { sourcePage: "Home" });
 *   trackAction("bottomnav_collection", { sourcePage: "Home", metadata: { panel: "collection" } });
 */

import { supabase } from "@/api/supabaseClient";
import { getCurrentAuthUser } from "@/api/authService";

/** Per-event cooldown in milliseconds. Prevents duplicate events from rapid clicks. */
const COOLDOWN_MS = 1500;

/** In-memory cooldown map: eventName → last tracked timestamp (ms). */
const cooldownMap = new Map();

/**
 * Track a named user action. Fire-and-forget – never throws.
 *
 * @param {string} eventName - Unique event identifier, e.g. "home_scan_click"
 * @param {{ sourcePage?: string, metadata?: Record<string, unknown> }} [options]
 */
export async function trackAction(eventName, { sourcePage = null, metadata = {} } = {}) {
  try {
    const now = Date.now();
    const lastTs = cooldownMap.get(eventName) ?? 0;
    if (now - lastTs < COOLDOWN_MS) return;
    cooldownMap.set(eventName, now);

    const authUser = await getCurrentAuthUser();
    if (!authUser?.id) return;

    await supabase.from("UserActionEvent").insert([{
      auth_id: authUser.id,
      event_name: String(eventName),
      source_page: sourcePage ?? null,
      metadata: metadata || {},
    }]);
  } catch {
    // Fire-and-forget: tracking must never break UI interactions.
  }
}

/**
 * Fetch all UserActionEvents from the last 30 days.
 * Used by KPIAdmin to avoid loading unbounded data as the table grows.
 *
 * @returns {Promise<Array>}
 */
export async function fetchActionEvents30d() {
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("UserActionEvent")
      .select("id, auth_id, event_name, source_page, metadata, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false });
    if (error) {
      console.warn("[analyticsService] fetchActionEvents30d error:", error?.message);
      return [];
    }
    return data || [];
  } catch {
    return [];
  }
}
