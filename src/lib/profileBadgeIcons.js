import {
  BadgeCheck,
  BookmarkCheck,
  CalendarCheck2,
  CalendarDays,
  Camera,
  Flame,
  Heart,
  HeartPulse,
  InspectionPanel,
  MapPinCheck,
  Medal,
  Star,
  Wand,
  Waypoints,
} from "lucide-react";

const PROFILE_BADGE_ICON_MAP = {
  waypoints: Waypoints,
  camera: Camera,
  medal: Medal,
  heart: Heart,
  "inspection-panel": InspectionPanel,
  "square-star": Star,
  "heart-pulse": HeartPulse,
  wand: Wand,
  "bookmark-check": BookmarkCheck,
  "calendar-check-2": CalendarCheck2,
  flame: Flame,
  "calendar-days": CalendarDays,
  "map-pin-check": MapPinCheck,
};

export const getProfileBadgeIconComponent = (iconKey) => {
  const normalizedKey = String(iconKey || "").trim().toLowerCase();
  return PROFILE_BADGE_ICON_MAP[normalizedKey] || BadgeCheck;
};

export { PROFILE_BADGE_ICON_MAP };
