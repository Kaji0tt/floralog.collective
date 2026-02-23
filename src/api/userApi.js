// User API utilities using Supabase Auth

import { getCurrentAuthUser, getUserProfile, upsertUserProfile } from './authService';
const baseUserProxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/baseUserProxy`;

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

/**
 * Get current user from Supabase Auth + Profile
 */
export const getCurrentUser = async () => {
  try {
    const authUser = await getCurrentAuthUser();
    if (!authUser) {
      return null;
    }
    
    // Enrich with profile data
    const profile = await getUserProfile(authUser.id);

    const profileDisplayName = normalizeName(profile?.display_name);
    const profileFullName = normalizeName(profile?.full_name);
    const metadataName = getMetadataName(authUser);

    const hasName = Boolean(profileDisplayName || profileFullName || metadataName);

    let legacyFallback = null;
    if (!hasName) {
      legacyFallback = await resolveLegacyNameFallback(authUser);
    }

    const legacyName = normalizeName(legacyFallback?.display_name);
    const resolvedDisplayName = profileDisplayName || metadataName || legacyName;
    const resolvedFullName = profileFullName || metadataName || legacyName;

    return {
      ...authUser,
      ...legacyFallback,
      ...profile,
      // WICHTIG: immer Supabase-Auth-ID als eindeutige User-ID verwenden
      // und nicht von baseUser/legacy überschreiben lassen
      id: authUser.id,
      auth_id: authUser.id,
      display_name: resolvedDisplayName || null,
      full_name: resolvedFullName || null
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

