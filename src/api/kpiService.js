const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const toDate = (raw) => {
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const extractUserKey = (entry) => {
  const candidate =
    entry?.auth_id ||
    entry?.created_by_id ||
    entry?.user_id ||
    entry?.profile_id ||
    entry?.user_email ||
    entry?.user ||
    entry?.created_by ||
    null;

  if (!candidate) return null;
  return String(candidate).trim().toLowerCase() || null;
};

const extractDiscoveryDate = (entry) =>
  toDate(entry?.discovered_date);

const extractLikeDate = (entry) =>
  toDate(entry?.created_date || entry?.liked_date || entry?.created_at || entry?.updated_date);

const extractMapViewDate = (entry) =>
  toDate(entry?.created_date || entry?.created_at || entry?.updated_date);

const formatDayKey = (date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const startOfUtcDayMs = (date) => Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

const formatMonthKey = (date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const getEntriesInWindow = (entries, getDate, startInclusiveMs, endExclusiveMs) =>
  entries.filter((entry) => {
    const date = getDate(entry);
    if (!date) return false;
    const time = date.getTime();
    return time >= startInclusiveMs && time < endExclusiveMs;
  });

const getUniqueUserCount = (entries) => {
  const set = new Set();
  entries.forEach((entry) => {
    const key = extractUserKey(entry);
    if (key) set.add(key);
  });
  return set.size;
};

const calcTrend = (currentValue, previousValue) => {
  const curr = Number(currentValue || 0);
  const prev = Number(previousValue || 0);

  if (prev <= 0 && curr <= 0) {
    return { direction: "flat", deltaPercent: 0 };
  }

  if (prev <= 0 && curr > 0) {
    return { direction: "up", deltaPercent: 100 };
  }

  const rawDeltaPercent = ((curr - prev) / prev) * 100;
  const rounded = Number(rawDeltaPercent.toFixed(1));

  if (Math.abs(rounded) < 0.05) {
    return { direction: "flat", deltaPercent: 0 };
  }

  return {
    direction: rounded > 0 ? "up" : "down",
    deltaPercent: Math.abs(rounded),
  };
};

export function buildGlobalKpiSummary({ discoveries = [], profiles = [], scanLikes = [], mapViews = [], now = new Date() } = {}) {
  const nowMs = Number.isFinite(now?.getTime?.()) ? now.getTime() : Date.now();

  const current24hDiscoveries = getEntriesInWindow(discoveries, extractDiscoveryDate, nowMs - DAY_MS, nowMs);
  const previous24hDiscoveries = getEntriesInWindow(discoveries, extractDiscoveryDate, nowMs - 2 * DAY_MS, nowMs - DAY_MS);

  const current7dDiscoveries = getEntriesInWindow(discoveries, extractDiscoveryDate, nowMs - 7 * DAY_MS, nowMs);
  const previous7dDiscoveries = getEntriesInWindow(discoveries, extractDiscoveryDate, nowMs - 14 * DAY_MS, nowMs - 7 * DAY_MS);

  const current30dDiscoveries = getEntriesInWindow(discoveries, extractDiscoveryDate, nowMs - 30 * DAY_MS, nowMs);
  const previous30dDiscoveries = getEntriesInWindow(discoveries, extractDiscoveryDate, nowMs - 60 * DAY_MS, nowMs - 30 * DAY_MS);

  const current30dLikes = getEntriesInWindow(scanLikes, extractLikeDate, nowMs - 30 * DAY_MS, nowMs);
  const previous30dLikes = getEntriesInWindow(scanLikes, extractLikeDate, nowMs - 60 * DAY_MS, nowMs - 30 * DAY_MS);

  const current24hMapViews = getEntriesInWindow(mapViews, extractMapViewDate, nowMs - DAY_MS, nowMs);
  const current7dMapViews = getEntriesInWindow(mapViews, extractMapViewDate, nowMs - 7 * DAY_MS, nowMs);
  const current30dMapViews = getEntriesInWindow(mapViews, extractMapViewDate, nowMs - 30 * DAY_MS, nowMs);

  const active24h = getUniqueUserCount(current24hDiscoveries);
  const prevActive24h = getUniqueUserCount(previous24hDiscoveries);

  const active7d = getUniqueUserCount(current7dDiscoveries);
  const prevActive7d = getUniqueUserCount(previous7dDiscoveries);

  const active30d = getUniqueUserCount(current30dDiscoveries);
  const prevActive30d = getUniqueUserCount(previous30dDiscoveries);

  const stickiness = active30d > 0 ? (active24h / active30d) * 100 : 0;
  const previousStickiness = prevActive30d > 0 ? (prevActive24h / prevActive30d) * 100 : 0;

  const scans24h = current24hDiscoveries.length;
  const prevScans24h = previous24hDiscoveries.length;

  const likes30d = current30dLikes.length;
  const prevLikes30d = previous30dLikes.length;

  const scansPerUserDay = active24h > 0 ? scans24h / active24h : 0;
  const scansPerUserWeek = active7d > 0 ? current7dDiscoveries.length / active7d : 0;
  const scansPerUserMonth = active30d > 0 ? current30dDiscoveries.length / active30d : 0;

  const mapUsersDay = getUniqueUserCount(current24hMapViews);
  const mapUsersWeek = getUniqueUserCount(current7dMapViews);
  const mapUsersMonth = getUniqueUserCount(current30dMapViews);
  const mapViewsPerUserDay = mapUsersDay > 0 ? current24hMapViews.length / mapUsersDay : 0;
  const mapViewsPerUserWeek = mapUsersWeek > 0 ? current7dMapViews.length / mapUsersWeek : 0;
  const mapViewsPerUserMonth = mapUsersMonth > 0 ? current30dMapViews.length / mapUsersMonth : 0;

  const totalUsers = Array.isArray(profiles) ? profiles.length : 0;

  return {
    generatedAt: new Date(nowMs).toISOString(),
    totals: {
      users: totalUsers,
      discoveries: Array.isArray(discoveries) ? discoveries.length : 0,
      likes: Array.isArray(scanLikes) ? scanLikes.length : 0,
      mapViews: Array.isArray(mapViews) ? mapViews.length : 0,
    },
    averages: {
      scansPerUser: {
        day: scansPerUserDay,
        week: scansPerUserWeek,
        month: scansPerUserMonth,
      },
      mapViewsPerUser: {
        day: mapViewsPerUserDay,
        week: mapViewsPerUserWeek,
        month: mapViewsPerUserMonth,
      },
    },
    metrics: [
      {
        id: "active_24h",
        label: "Aktive Nutzer (24h)",
        value: active24h,
        type: "count",
        trend: calcTrend(active24h, prevActive24h),
      },
      {
        id: "active_7d",
        label: "WAU (7 Tage)",
        value: active7d,
        type: "count",
        trend: calcTrend(active7d, prevActive7d),
      },
      {
        id: "active_30d",
        label: "MAU (30 Tage)",
        value: active30d,
        type: "count",
        trend: calcTrend(active30d, prevActive30d),
      },
      {
        id: "stickiness",
        label: "Stickiness (DAU/MAU)",
        value: stickiness,
        type: "percent",
        trend: calcTrend(stickiness, previousStickiness),
      },
      {
        id: "scans_24h",
        label: "Scans (24h)",
        value: scans24h,
        type: "count",
        trend: calcTrend(scans24h, prevScans24h),
      },
      {
        id: "likes_30d",
        label: "Likes (30 Tage)",
        value: likes30d,
        type: "count",
        trend: calcTrend(likes30d, prevLikes30d),
      },
    ],
  };
}

export function buildDauWauMauSeries({ discoveries = [], now = new Date(), days = 90, startDate = null } = {}) {
  const dayCount = Math.max(7, Number(days) || 90);
  const endMs = startOfUtcDayMs(Number.isFinite(now?.getTime?.()) ? now : new Date());
  const startFilterMs = startDate
    ? startOfUtcDayMs(Number.isFinite(new Date(startDate).getTime()) ? new Date(startDate) : new Date(0))
    : null;

  const usersByDay = new Map();

  discoveries.forEach((discovery) => {
    const date = extractDiscoveryDate(discovery);
    const userKey = extractUserKey(discovery);
    if (!date || !userKey) return;

    const dayKey = formatDayKey(date);
    if (!usersByDay.has(dayKey)) usersByDay.set(dayKey, new Set());
    usersByDay.get(dayKey).add(userKey);
  });

  const collectUsersInWindow = (anchorMs, windowDays) => {
    const users = new Set();
    for (let offset = 0; offset < windowDays; offset += 1) {
      const dayMs = anchorMs - offset * DAY_MS;
      const dayKey = formatDayKey(new Date(dayMs));
      const dayUsers = usersByDay.get(dayKey);
      if (!dayUsers) continue;
      dayUsers.forEach((user) => users.add(user));
    }
    return users;
  };

  const series = [];

  for (let i = dayCount - 1; i >= 0; i -= 1) {
    const dayMs = endMs - i * DAY_MS;
    if (startFilterMs !== null && dayMs < startFilterMs) continue;

    const dayKey = formatDayKey(new Date(dayMs));
    const dauUsers = usersByDay.get(dayKey) || new Set();
    const wauUsers = collectUsersInWindow(dayMs, 7);
    const mauUsers = collectUsersInWindow(dayMs, 30);

    const dau = dauUsers.size;
    const wau = wauUsers.size;
    const mau = mauUsers.size;
    const stickiness = mau > 0 ? Number(((dau / mau) * 100).toFixed(2)) : 0;

    series.push({
      dateKey: dayKey,
      timestampMs: dayMs,
      dau,
      wau,
      mau,
      stickiness,
    });
  }

  return series;
}

const extractDateFlexible = (entry) =>
  toDate(
    entry?.created_date ||
    entry?.created_at ||
    entry?.unlocked_date ||
    entry?.accepted_at ||
    null
  );

const FEATURE_COLORS = {
  scanner: "#16a34a",
  map: "#0ea5e9",
  likes: "#ec4899",
  quests: "#f59e0b",
  weekly_quests: "#f97316",
  achievements: "#8b5cf6",
  friends: "#06b6d4",
  collections: "#6366f1",
};

const ACTION_EVENT_LABELS = {
  home_scan_click: "Scannen-Button",
  home_logo_overlay_open: "Logo → Overlay öffnen",
  home_overlay_health_stats: "Pflanzenstatus anzeigen",
  home_overlay_shop_open: "Shop öffnen (Overlay)",
  home_settings_open: "Einstellungen öffnen",
  home_milestone_action: "Milestone-Aktion (Stripe)",
  home_panel_return: "Zurück zur Startseite",
  bottomnav_collection: "Nav → Kollektion",
  bottomnav_achievements: "Nav → Erfolge / Quests",
  bottomnav_map: "Nav → Karte",
  bottomnav_social: "Nav → Social",
};

const ACTION_EVENT_COLORS = {
  home_scan_click: "#16a34a",
  home_logo_overlay_open: "#0ea5e9",
  home_overlay_health_stats: "#ec4899",
  home_overlay_shop_open: "#f59e0b",
  home_settings_open: "#78716c",
  home_milestone_action: "#f97316",
  home_panel_return: "#94a3b8",
  bottomnav_collection: "#6366f1",
  bottomnav_achievements: "#8b5cf6",
  bottomnav_map: "#06b6d4",
  bottomnav_social: "#10b981",
};

/**
 * Aggregates UserActionEvent records into per-event summaries.
 * Input events should already be filtered to a relevant time window (e.g. last 30d).
 */
export function buildActionEventSummary({ events = [], now = new Date() } = {}) {
  const nowMs = Number.isFinite(now?.getTime?.()) ? now.getTime() : Date.now();
  const day7StartMs = nowMs - 7 * DAY_MS;

  const byName = new Map();

  events.forEach((event) => {
    const name = event?.event_name;
    if (!name) return;
    const ts = Number.isFinite(new Date(event?.created_at || 0).getTime())
      ? new Date(event.created_at).getTime()
      : 0;
    if (!ts) return;

    if (!byName.has(name)) {
      byName.set(name, { count7d: 0, count30d: 0, users7d: new Set(), users30d: new Set() });
    }
    const bucket = byName.get(name);
    const authId = String(event?.auth_id || "");

    bucket.count30d += 1;
    if (authId) bucket.users30d.add(authId);

    if (ts >= day7StartMs) {
      bucket.count7d += 1;
      if (authId) bucket.users7d.add(authId);
    }
  });

  const total30d = Array.from(byName.values()).reduce((sum, b) => sum + b.count30d, 0);

  const result = Array.from(byName.entries())
    .map(([name, data]) => ({
      eventName: name,
      label: ACTION_EVENT_LABELS[name] || name,
      color: ACTION_EVENT_COLORS[name] || "#64748b",
      count7d: data.count7d,
      count30d: data.count30d,
      uniqueUsers7d: data.users7d.size,
      uniqueUsers30d: data.users30d.size,
      sharePercent: total30d > 0 ? Number(((data.count30d / total30d) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.count30d - a.count30d);

  return {
    events: result,
    topEvent: result[0] ?? null,
    totalEvents30d: total30d,
    generatedAt: new Date(nowMs).toISOString(),
  };
}

export function buildFeatureUsageSummary({
  discoveries = [],
  mapViews = [],
  scanLikes = [],
  friends = [],
  achievements = [],
  userQuests = [],
  userWeeklyQuests = [],
  userCollections = [],
  now = new Date(),
} = {}) {
  const nowMs = Number.isFinite(now?.getTime?.()) ? now.getTime() : Date.now();
  const day7StartMs = nowMs - 7 * DAY_MS;
  const day30StartMs = nowMs - 30 * DAY_MS;

  const countInWindow = (entries, getDate, startMs) =>
    entries.filter((e) => {
      const d = getDate(e);
      return d && d.getTime() >= startMs && d.getTime() < nowMs;
    }).length;

  const extractCollectionDate = (e) => toDate(e?.created_at || null);

  const featureDefs = [
    { key: "scanner", label: "Scanner", description: "Pflanzen-Scans", entries: discoveries, getDate: extractDiscoveryDate },
    { key: "map", label: "Karte", description: "Kartenaufrufe", entries: mapViews, getDate: extractMapViewDate },
    { key: "likes", label: "Likes", description: "Scan-Likes (Social)", entries: scanLikes, getDate: extractLikeDate },
    { key: "quests", label: "Quests", description: "Quest-Aktivierungen", entries: userQuests, getDate: extractDateFlexible },
    { key: "weekly_quests", label: "Wöchentl. Quests", description: "Wöchentliche Quests", entries: userWeeklyQuests, getDate: extractDateFlexible },
    { key: "achievements", label: "Achievements", description: "Erzielte Erfolge", entries: achievements, getDate: extractDateFlexible },
    { key: "friends", label: "Freunde", description: "Neue Freundschaften", entries: friends, getDate: extractDateFlexible },
    { key: "collections", label: "Kollektionen", description: "Sammlung-Beitritte", entries: userCollections, getDate: extractCollectionDate },
  ];

  const raw = featureDefs.map(({ key, label, description, entries, getDate }) => ({
    key,
    label,
    description,
    count7d: countInWindow(entries, getDate, day7StartMs),
    count30d: countInWindow(entries, getDate, day30StartMs),
    color: FEATURE_COLORS[/** @type {keyof typeof FEATURE_COLORS} */ (key)] || "#78716c",
  }));

  const total30d = raw.reduce((sum, f) => sum + f.count30d, 0);

  const features = raw
    .map((f) => ({
      ...f,
      sharePercent: total30d > 0 ? Number(((f.count30d / total30d) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.count30d - a.count30d);

  return {
    features,
    topFeature: features[0] ?? null,
    totalEvents30d: total30d,
    generatedAt: new Date(nowMs).toISOString(),
  };
}

export function buildMonthlyTopScannerSummary({ discoveries = [], profiles = [], now = new Date(), topLimit = 10 } = {}) {
  const monthCountsByUser = new Map();

  discoveries.forEach((discovery) => {
    const date = extractDiscoveryDate(discovery);
    const userKey = extractUserKey(discovery);
    if (!date || !userKey) return;

    const monthKey = formatMonthKey(date);
    if (!monthCountsByUser.has(monthKey)) monthCountsByUser.set(monthKey, new Map());
    const monthMap = monthCountsByUser.get(monthKey);
    monthMap.set(userKey, (monthMap.get(userKey) || 0) + 1);
  });

  const profileNameByKey = new Map();
  profiles.forEach((profile) => {
    const key = extractUserKey(profile);
    if (!key) return;

    const displayName =
      profile?.display_name ||
      profile?.full_name ||
      profile?.email ||
      profile?.user_email ||
      profile?.auth_id ||
      profile?.user_id ||
      profile?.id ||
      "Unbekannt";

    profileNameByKey.set(key, String(displayName));
  });

  const nowDate = Number.isFinite(now?.getTime?.()) ? now : new Date();
  const currentMonthKey = formatMonthKey(nowDate);
  const currentMonthMap = monthCountsByUser.get(currentMonthKey) || new Map();

  const currentMonthTop = Array.from(currentMonthMap.entries())
    .map(([userKey, scans]) => ({
      userKey,
      playerName: profileNameByKey.get(userKey) || userKey,
      scans,
    }))
    .sort((a, b) => b.scans - a.scans)
    .slice(0, Math.max(1, Number(topLimit) || 10));

  const monthKeys = Array.from(monthCountsByUser.keys()).sort();
  const monthlyLeaders = monthKeys.map((monthKey) => {
    const monthMap = monthCountsByUser.get(monthKey) || new Map();
    let leader = null;
    monthMap.forEach((scans, userKey) => {
      if (!leader || scans > leader.scans) {
        leader = {
          monthKey,
          userKey,
          playerName: profileNameByKey.get(userKey) || userKey,
          scans,
        };
      }
    });
    return leader;
  }).filter(Boolean);

  const monthlyRecord = monthlyLeaders.reduce((best, current) => {
    if (!best || current.scans > best.scans) return current;
    return best;
  }, null);

  const currentMonthTotalScans = Array.from(currentMonthMap.values()).reduce((sum, value) => sum + value, 0);
  const currentMonthActivePlayers = currentMonthMap.size;

  return {
    currentMonthKey,
    currentMonthTotalScans,
    currentMonthActivePlayers,
    currentMonthTop,
    monthlyLeaders,
    monthlyRecord,
  };
}
