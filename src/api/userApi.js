// User API utilities using Supabase Auth

import { getCurrentAuthUser, getUserProfile, upsertUserProfile } from './authService';
import { supabase } from './supabaseClient';
const baseUserProxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/baseUserProxy`;

const BOT_NAME_STORY_CONTEXT = [
  'Florabot ist ein freundlicher, neugieriger KI-Begleiter in einer Natur-App.',
  'Der Bot motiviert Spieler beim Pflanzen-Scannen und fuehrt spielerisch durch die Story.',
  'Der Name soll warm, naturverbunden und leicht merkbar sein.',
  'Dieser Florabot soll der Begleiter von %display_name% werden und zu diesem Namen passen.'
].join(' ');

const invokeBaseUserProxy = async (action, payload) => {
  const response = await fetch(baseUserProxyUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      action,
      ...payload
    })
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result?.error || `baseUserProxy request failed (${response.status})`);
  }

  if (result?.error) throw new Error(result.error);
  return result?.data || null;
};

const normalizeName = (value) => {
  const trimmed = value?.trim?.();
  return trimmed || null;
};

const getMetadataName = (authUser) => {
  const metadata = authUser?.user_metadata || {};
  return normalizeName(metadata.display_name) || normalizeName(metadata.full_name) || normalizeName(metadata.name);
};

const getLegacyFallbackName = (legacyFallback) => {
  return normalizeName(legacyFallback?.display_name) || normalizeName(legacyFallback?.full_name);
};

const resolveLegacyNameFallback = async (authUser) => {
  if (!authUser?.email) return null;

  try {
    const data = await invokeBaseUserProxy('getProfile', { email: authUser.email });
    return data || null;
  } catch (error) {
    console.warn('[userApi] baseUser fallback lookup failed:', error.message);
    return null;
  }
};

const normalizeBotName = (value) => {
  const cleaned = String(value || '')
    .replace(/[^A-Za-z\u00C0-\u017F\-\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 28);
  return cleaned || null;
};

const hashSeed = (value) => {
  const text = String(value || 'floralog');
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
};

const createFallbackBotName = (seedSource) => {
  const seed = hashSeed(seedSource);
  const consonants = 'bcdfghjklmnprstvz';
  const vowels = 'aeiou';
  const syllableCount = 2 + (seed % 2);

  let name = '';
  for (let i = 0; i < syllableCount; i += 1) {
    const c = consonants[(seed + i * 7) % consonants.length];
    const v = vowels[(seed + i * 11) % vowels.length];
    name += `${c}${v}`;
  }

  const suffixes = ['ra', 'lo', 'na', 'ri', 'ta', 'mo'];
  name += suffixes[seed % suffixes.length];

  return `${name.charAt(0).toUpperCase()}${name.slice(1)}`;
};

const generateBotNameWithModel = async ({ displayName, authId }) => {
  try {
    const ownerName = normalizeName(displayName) || 'dem Spieler';
    const storyContextWithOwner = BOT_NAME_STORY_CONTEXT.replace('%display_name%', ownerName);

    const { data, error } = await supabase.functions.invoke('generateBotName', {
      body: {
        displayName: displayName || null,
        storyContext: storyContextWithOwner,
      },
    });

    if (error) {
      throw error;
    }

    const modelName = normalizeBotName(data?.bot_name);
    if (modelName) {
      return modelName;
    }
  } catch (error) {
    console.warn('[userApi] generateBotName function failed, using fallback:', error?.message || error);
  }

  return createFallbackBotName(displayName || authId || 'floralog');
};

/**
 * Get current user from Supabase Auth + Profile
 */
export const getCurrentUser = async () => {
  try {
    const authUser = await getCurrentAuthUser();
    if (!authUser) {
      return null;
    }
    
    let profile = await getUserProfile(authUser.id);
    const metadataName = getMetadataName(authUser);

    let legacyFallback = null;
    const needsLegacyFallback = !profile || (!normalizeName(profile?.display_name) && !normalizeName(profile?.full_name) && !metadataName);
    if (needsLegacyFallback) {
      legacyFallback = await resolveLegacyNameFallback(authUser);
    }

    if (!profile) {
      try {
        const fallbackName = getLegacyFallbackName(legacyFallback);
        profile = await upsertUserProfile(authUser.id, {
          user_email: authUser.email || null,
          display_name: metadataName || fallbackName,
          full_name: metadataName || fallbackName,
        });
      } catch (error) {
        console.warn('[userApi] PublicProfile bootstrap failed:', error.message);
      }
    }

    const profileDisplayName = normalizeName(profile?.display_name);
    const profileFullName = normalizeName(profile?.full_name);
    const legacyName = getLegacyFallbackName(legacyFallback);
    const resolvedDisplayName = profileDisplayName || metadataName || legacyName;
    const resolvedFullName = profileFullName || metadataName || legacyName;
    let resolvedBotName = normalizeBotName(profile?.bot_name);

    if (!resolvedBotName) {
      const generatedBotName = await generateBotNameWithModel({
        displayName: resolvedDisplayName,
        authId: authUser.id,
      });

      resolvedBotName = normalizeBotName(generatedBotName);

      if (resolvedBotName) {
        try {
          const upsertedProfile = await upsertUserProfile(authUser.id, {
            user_email: authUser.email || null,
            display_name: resolvedDisplayName || null,
            full_name: resolvedFullName || null,
            bot_name: resolvedBotName,
          });

          profile = upsertedProfile || profile;
        } catch (error) {
          console.warn('[userApi] Failed to persist generated bot_name:', error.message);
        }
      }
    }

    return {
      ...authUser,
      ...legacyFallback,
      ...profile,
      // WICHTIG: immer Supabase-Auth-ID als eindeutige User-ID verwenden
      // und nicht von baseUser/legacy überschreiben lassen
      id: authUser.id,
      auth_id: authUser.id,
      display_name: resolvedDisplayName || null,
      full_name: resolvedFullName || null,
      bot_name: resolvedBotName || normalizeBotName(profile?.bot_name) || null
    };
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};

/**
 * Update current user's PublicProfile data
 */
export const updateCurrentUserProfile = async (updates) => {
  const authUser = await getCurrentAuthUser();
  if (!authUser?.id) {
    throw new Error('Auth session missing');
  }

  const profile = await upsertUserProfile(authUser.id, updates);
  return {
    ...authUser,
    ...profile
  };
};

