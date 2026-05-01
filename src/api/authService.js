// Supabase Auth Service
import { supabase } from './supabaseClient';

const getAuthRedirectBaseUrl = () => {
  return import.meta.env.VITE_APP_URL || window.location.origin;
};

const looksLikeHtmlResponseError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  return (
    error instanceof SyntaxError
    || (message.includes('unexpected token') && message.includes('doctype'))
    || message.includes('is not valid json')
  );
};

const normalizeAuthServiceError = (error) => {
  if (!looksLikeHtmlResponseError(error)) {
    return error;
  }

  return new Error(
    'Auth-Service lieferte HTML statt JSON. Bitte pruefe VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY und moegliche Proxy/Rewrite-Regeln.'
  );
};

const isMissingAuthSessionError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  return error?.name === 'AuthSessionMissingError' || message.includes('auth session missing');
};

/**
 * Sign up with email and password
 */
export const signUp = async (email, password, displayName) => {
  const trimmedDisplayName = displayName?.trim?.() || '';

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: trimmedDisplayName,
          full_name: trimmedDisplayName,
          name: trimmedDisplayName
        },
        emailRedirectTo: `${getAuthRedirectBaseUrl()}/login`
      }
    });
    if (error) throw error;
    return data;
  } catch (error) {
    throw normalizeAuthServiceError(error);
  }
};

/**
 * Sign in with email and password
 */
export const signIn = async (email, password) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    return data;
  } catch (error) {
    throw normalizeAuthServiceError(error);
  }
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
    redirectTo: `${getAuthRedirectBaseUrl()}/reset-password`
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
 * Update auth user metadata
 */
export const updateAuthUser = async (updates) => {
  const { data, error } = await supabase.auth.updateUser({
    data: updates
  });
  if (error) throw error;
  return data?.user || null;
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
  if (error) {
    if (isMissingAuthSessionError(error)) {
      return null;
    }
    throw error;
  }
  return user;
};

/**
 * Get user profile from PublicProfile table
 */
export const getUserProfile = async (authId) => {
  if (!authId) return null;
  
  const { data, error } = await supabase
    .from('PublicProfile')
    .select('*')
    .eq('auth_id', authId)
    .single();
  
  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
    throw error;
  }
  
  return data || null;
};

/**
 * Create or update user profile
 */
export const upsertUserProfile = async (authId, profileData) => {
  // Erst prüfen, ob das Profil schon existiert
  const { data: existing } = await supabase
    .from('PublicProfile')
    .select('id')
    .eq('auth_id', authId)
    .maybeSingle(); // ✅ Nicht .single()! Gibt null zurück statt Error, wenn kein Profil existiert

  if (existing) {
    // Update existierendes Profil
    const { data, error } = await supabase
      .from('PublicProfile')
      .update({
        ...profileData,
        updated_date: new Date().toISOString()
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } else {
    // Erstelle neues Profil
    const { data, error } = await supabase
      .from('PublicProfile')
      .insert({
        id: authId,
        auth_id: authId,
        ...profileData,
        created_date: new Date().toISOString(),
        updated_date: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};

/**
 * Listen to auth changes
 */
export const onAuthChange = (callback) => {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
};
