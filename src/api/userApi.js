// User API utilities using Supabase Auth

import { getCurrentAuthUser, getUserProfile, upsertUserProfile } from './authService';
import { supabase } from './supabaseClient';

const resolveLegacyNameFallback = async (authUser) => {
  if (!authUser?.id || !authUser?.email) return null;

  const { data, error } = await supabase
    .from('baseUser')
    .select('display_name, full_name')
    .or(`auth_id.eq.${authUser.id},email.eq.${authUser.email}`)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('[userApi] baseUser fallback lookup failed:', error.message);
    return null;
  }

  return data || null;
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

    const hasName = Boolean(
      profile?.display_name ||
      profile?.full_name ||
      authUser?.user_metadata?.display_name ||
      authUser?.user_metadata?.full_name ||
      authUser?.user_metadata?.name
    );

    let legacyFallback = null;
    if (!hasName) {
      legacyFallback = await resolveLegacyNameFallback(authUser);
    }

    return {
      ...authUser,
      ...legacyFallback,
      ...profile // Merge profile data into user object
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

