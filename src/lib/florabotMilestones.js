/**
 * Florabot milestone helpers.
 *
 * Milestone data is derived from storyDefinition.js (single source of truth).
 * This file provides FLORABOT_MILESTONES and localStorage helpers.
 *
 * localStorage key: florabot_milestones_seen_v1:<auth_id>
 * Value: JSON array of milestone ids that have been shown, e.g. ["m500","m1000"]
 */

import { STORY_PROGRESS_CONDITIONS, STORY_COPY } from "@/lib/story/storyDefinition";

/**
 * Derived from STORY_PROGRESS_CONDITIONS.milestones + STORY_COPY.milestones.
 * contextBubble panel is resolved via STORY_PROGRESS_CONDITIONS.contextBubbles.
 */
export const FLORABOT_MILESTONES = STORY_PROGRESS_CONDITIONS.milestones.map(
  ({ id, thresholdSeeds, navHighlight }) => {
    const copy = STORY_COPY.milestones[id] || {};
    const contextBubbleDef = (STORY_PROGRESS_CONDITIONS.contextBubbles || []).find(
      (cb) => cb.requiresMilestoneSeen === id
    );
    const contextBubble =
      copy.contextBubble && contextBubbleDef
        ? { panel: contextBubbleDef.triggerPanel, message: copy.contextBubble }
        : null;
    return {
      id,
      threshold: thresholdSeeds,
      navHighlight,
      contextBubble,
      messages: Array.isArray(copy.messages) ? copy.messages : [],
    };
  }
);

/**
 * Returns the localStorage key for milestone state for a given auth id.
 * @param {string} authId
 */
export function getMilestoneStorageKey(authId) {
  return `florabot_milestones_seen_v1:${authId}`;
}

/**
 * Returns the set of already-seen milestone ids from localStorage.
 * @param {string} authId
 * @returns {Set<string>}
 */
export function getSeenMilestoneIds(authId) {
  try {
    const raw = localStorage.getItem(getMilestoneStorageKey(authId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

/**
 * Marks a milestone as seen in localStorage.
 * @param {string} authId
 * @param {string} milestoneId
 */
export function markMilestoneSeen(authId, milestoneId) {
  try {
    const key = getMilestoneStorageKey(authId);
    const seen = getSeenMilestoneIds(authId);
    seen.add(milestoneId);
    localStorage.setItem(key, JSON.stringify(Array.from(seen)));
  } catch {
    // ignore storage errors
  }
}

/**
 * Returns the lowest-threshold unseen milestone that the wallet balance has crossed,
 * or null if none.
 * @param {number} walletBalance
 * @param {Set<string>} seenIds
 * @returns {object|null}
 */
export function getNextUnseenMilestone(walletBalance, seenIds) {
  if (typeof walletBalance !== "number" || walletBalance < 0) return null;
  for (const milestone of FLORABOT_MILESTONES) {
    if (walletBalance >= milestone.threshold && !seenIds.has(milestone.id)) {
      return milestone;
    }
  }
  return null;
}
