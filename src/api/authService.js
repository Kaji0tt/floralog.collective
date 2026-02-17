// Supabase Auth Service
import { supabase } from './supabaseClient';

/**
 * Sign up with email and password
 */
export const signUp = async (email, password) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password
  });
  if (error) throw error;
  return data;
};

/**
 * Sign in with email and password
 */
export const signIn = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  if (error) throw error;
  return data;
};

/**
 * Sign out current user
 */
export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

/**
 * Reset password with email
 */
export const resetPassword = async (email) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`
  });
  if (error) throw error;
};

/**
 * Update password
 */
export const updatePassword = async (newPassword) => {
  const { error } = await supabase.auth.updateUser({
    password: newPassword
  });
  if (error) throw error;
};

/**
 * Get current session
 */
export const getSession = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
};

/**
 * Get current user from auth
 */
export const getCurrentAuthUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
};

/**
 * Get user profile from PublicProfile table
 */
export const getUserProfile = async (email) => {
  if (!email) return null;
  
  const { data, error } = await supabase
    .from('PublicProfile')
    .select('*')
    .eq('user_email', email)
    .single();
  
  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
    throw error;
  }
  
  return data || null;
};

/**
 * Create or update user profile
 */
export const upsertUserProfile = async (email, profileData) => {
  const { data, error } = await supabase
    .from('PublicProfile')
    .upsert({
      user_email: email,
      ...profileData,
      updated_date: new Date().toISOString()
    }, { onConflict: 'user_email' })
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

/**
 * Listen to auth changes
 */
export const onAuthChange = (callback) => {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
};
