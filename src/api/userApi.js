// User API utilities using Supabase Auth

import { getCurrentAuthUser, getUserProfile } from './authService';

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

