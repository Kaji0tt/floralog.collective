// Supabase Auth Service
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { supabase } from './supabaseClient';
import { resolveReferralEmail } from '@/lib/referralCode';

const baseUserProxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/baseUserProxy`;

// Must match the Android intent-filter / iOS CFBundleURLTypes scheme.
const NATIVE_OAUTH_REDIRECT_URL = 'floralog://open';

/**
 * Resolve the referrer email from a referral code stored in localStorage.
 * Returns null when no (valid) referral code is present.
 */
const resolveStoredReferrerEmail = () => {
  try {
    if (typeof localStorage === 'undefined') return null;
    const referralCode = localStorage.getItem('referral_code');
    if (!referralCode) return null;
    return resolveReferralEmail(referralCode) || null;
  } catch {
    return null;
  }
};

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

const normalizeEmail = (value) => value?.trim?.().toLowerCase() || null;

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
  if (result?.error) {
    throw new Error(result.error);
  }
  return result?.data || null;
};

const syncEmailToProfileAndBaseUser = async ({ authId, oldEmail, newEmail, displayName }) => {
  if (!authId || !newEmail) return;

  const profileUpdatePromise = supabase
    .from('PublicProfile')
    .update({
      user_email: newEmail,
      updated_date: new Date().toISOString()
    })
    .eq('auth_id', authId);

  const baseUserSyncPromise = invokeBaseUserProxy('syncEmail', {
    authId,
    oldEmail,
    newEmail,
    displayName
  });

  const [profileResult, baseUserResult] = await Promise.allSettled([
    profileUpdatePromise,
    baseUserSyncPromise
  ]);

  const failures = [];

  if (profileResult.status === 'rejected') {
    failures.push(`PublicProfile Sync fehlgeschlagen: ${profileResult.reason?.message || String(profileResult.reason)}`);
  } else if (profileResult.value?.error) {
    failures.push(`PublicProfile Sync fehlgeschlagen: ${profileResult.value.error.message}`);
  }

  if (baseUserResult.status === 'rejected') {
    failures.push(`baseUser Sync fehlgeschlagen: ${baseUserResult.reason?.message || String(baseUserResult.reason)}`);
  }

  if (failures.length) {
    throw new Error(failures.join(' | '));
  }
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

  // Bind the referrer permanently to the new auth user via user_metadata.
  // This survives email confirmation, device/browser switches and app installs,
  // whereas localStorage alone is fragile.
  const referrerEmail = resolveStoredReferrerEmail();
  const signUpMetadata = {
    display_name: trimmedDisplayName,
    full_name: trimmedDisplayName,
    name: trimmedDisplayName
  };
  if (referrerEmail && referrerEmail.toLowerCase() !== email?.trim?.().toLowerCase()) {
    signUpMetadata.referred_by = referrerEmail;
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: signUpMetadata,
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
 * Sign in with Google via Supabase OAuth.
 * On native platforms, the system browser is opened manually and the
 * result is delivered back to the app through the `floralog://open` deep link
 * (handled by the appUrlOpen listener registered in AuthContext).
 */
export const signInWithGoogle = async () => {
  const isNative = Capacitor.isNativePlatform();

  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: isNative ? NATIVE_OAUTH_REDIRECT_URL : getAuthRedirectBaseUrl(),
        skipBrowserRedirect: isNative
      }
    });
    if (error) throw error;

    if (isNative && data?.url) {
      await Browser.open({ url: data.url });
    }

    return data;
  } catch (error) {
    throw normalizeAuthServiceError(error);
  }
};

/**
 * Complete the native Google sign-in after the app is re-opened via the
 * `floralog://open` deep link (called from the appUrlOpen listener).
 */
export const completeNativeOAuthSignIn = async (redirectUrl) => {
  try {
    const { data, error } = await supabase.auth.exchangeCodeForSession(redirectUrl);
    if (error) throw error;
    return data;
  } catch (error) {
    throw normalizeAuthServiceError(error);
  } finally {
    await Browser.close().catch(() => {});
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
 * Request auth email change (requires confirmation via email link)
 */
export const updateEmail = async (newEmail) => {
  const trimmedEmail = normalizeEmail(newEmail);
  if (!trimmedEmail) {
    throw new Error('Bitte gib eine gueltige E-Mail-Adresse ein.');
  }

  const authUser = await getCurrentAuthUser();
  if (!authUser?.id) {
    throw new Error('Auth session missing');
  }

  const oldEmail = normalizeEmail(authUser.email);
  const metadata = authUser.user_metadata || {};
  const displayName =
    metadata.display_name?.trim?.() ||
    metadata.full_name?.trim?.() ||
    metadata.name?.trim?.() ||
    null;

  try {
    const { data, error } = await supabase.auth.updateUser(
      {
        email: trimmedEmail
      },
      {
        emailRedirectTo: `${getAuthRedirectBaseUrl()}/confirm-email?email=${encodeURIComponent(trimmedEmail)}`
      }
    );
    if (error) throw error;

    await syncEmailToProfileAndBaseUser({
      authId: authUser.id,
      oldEmail,
      newEmail: trimmedEmail,
      displayName
    });

    return data?.user || null;
  } catch (error) {
    throw normalizeAuthServiceError(error);
  }
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
    .maybeSingle();
  
  if (error) {
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

const resolveAuthDisplayName = (authUser) => {
  const metadata = authUser?.user_metadata || {};
  const candidate =
    metadata.display_name ||
    metadata.full_name ||
    metadata.name ||
    authUser?.email?.split?.('@')?.[0] ||
    null;
  return typeof candidate === 'string' ? candidate.trim() || null : null;
};

/**
 * Ensure that an authenticated user has a PublicProfile row.
 * This is a client-side fallback in case trigger/backfill is missing in an environment.
 */
export const ensureUserProfileExists = async (authUser) => {
  if (!authUser?.id) return null;

  const existingProfile = await getUserProfile(authUser.id);
  if (existingProfile) {
    return existingProfile;
  }

  const fallbackName = resolveAuthDisplayName(authUser);
  return upsertUserProfile(authUser.id, {
    user_email: authUser.email || null,
    display_name: fallbackName,
    full_name: fallbackName
  });
};

/**
 * Listen to auth changes
 */
export const onAuthChange = (callback) => {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
};
