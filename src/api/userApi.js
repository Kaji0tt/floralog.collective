// User API utilities using Supabase Auth

import { getCurrentAuthUser, getUserProfile, upsertUserProfile } from './authService';

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
    const profile = await getUserProfile(authUser.email);
    return {
      ...authUser,
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
  if (!authUser?.email) {
    throw new Error('Auth session missing');
  }

  const profile = await upsertUserProfile(authUser.email, updates);
  return {
    ...authUser,
    ...profile
  };
};

