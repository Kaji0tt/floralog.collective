// Migration Service - handles legacy user migration to Supabase Auth with 2FA

import { supabase } from './supabaseClient';

const getAuthRedirectBaseUrl = () => {
  return import.meta.env.VITE_APP_URL || window.location.origin;
};

const normalizeEmail = (email) => email?.trim().toLowerCase();

const generateLegacyId = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
};

/**
 * Check if user exists in legacy "baseUser" table
 */
export const checkLegacyUser = async (email) => {
  const normalizedEmail = normalizeEmail(email);

  const { data, error } = await supabase
    .from('baseUser')
    .select('*')
    .eq('email', normalizedEmail)
    .single();
  
  if (error && error.code === 'PGRST116') {
    // No user found
    return null;
  }
  
  if (error) {
    console.error('Error checking legacy user:', error);
    throw error;
  }
  return data;
};

/**
 * Ensure a baseUser entry exists for newly registered users.
 * This keeps legacy data model in sync and stores display_name/email immediately.
 */
export const upsertLegacyUserFromRegistration = async ({ email, displayName, authId }) => {
  const normalizedEmail = normalizeEmail(email);
  const trimmedName = displayName?.trim();

  if (!normalizedEmail || !trimmedName) {
    throw new Error('E-Mail und Name sind für baseUser erforderlich.');
  }

  const existing = await checkLegacyUser(normalizedEmail);
  const timestamp = new Date().toISOString();

  if (existing) {
    const updatePayload = {
      display_name: existing.display_name || trimmedName,
      full_name: existing.full_name || trimmedName,
      user_email: existing.user_email || normalizedEmail,
      updated_date: timestamp
    };

    if (authId && !existing.auth_id) {
      updatePayload.auth_id = authId;
    }

    const { data, error } = await supabase
      .from('baseUser')
      .update(updatePayload)
      .eq('id', existing.id)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }

  const insertPayload = {
    id: generateLegacyId(),
    email: normalizedEmail,
    display_name: trimmedName,
    auth_id: authId || null,
    created_date: timestamp,
    updated_date: timestamp
  };

  const { data, error } = await supabase
    .from('baseUser')
    .insert(insertPayload)
    .select('*')
    .single();

  if (error) throw error;
  return data;
};

/**
 * Send OTP to legacy user via email for migration
 * Uses Supabase's built-in Email OTP functionality
 */
export const sendOtpToLegacyUser = async (email) => {
  // First, check if user exists in legacy baseUser table
  const legacyUser = await checkLegacyUser(email);
  if (!legacyUser) {
    throw new Error('Diese Email ist nicht in unserer Datenbank registriert. Bitte erstellen Sie einen neuen Account.');
  }

  // Send OTP via email using Supabase Auth
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      // This creates the Auth user if it doesn't exist yet, then sends OTP
      shouldCreateUser: true,
      emailRedirectTo: `${getAuthRedirectBaseUrl()}/migration/set-password`
    }
  });

  if (error) throw error;

  // Store migration email in localStorage for reference
  localStorage.setItem('migration_email', email);
  localStorage.setItem('migration_legacy_user_id', legacyUser.id);
  
  return true;
};

/**
 * Verify OTP code entered by user
 */
export const verifyOtpCode = async (email, token) => {
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email'
  });

  if (error) throw error;

  // If verification successful, store in session
  localStorage.setItem('migration_verified_email', email);
  localStorage.setItem('migration_verified_at', new Date().toISOString());

  return data;
};

/**
 * Migration steps with user-friendly names
 */
const MIGRATION_STEPS = [
  {
    key: 'profile',
    name: '📋 Mein Feldnotizbuch',
    tableName: 'PublicProfile',
    filterField: 'user_email'
  },
  {
    key: 'discoveries',
    name: '🔍 Vergessene Pflanzenfunde',
    tableName: 'UserPlantDiscovery',
    filterField: 'user'
  },
  {
    key: 'notifications',
    name: '📬 Botaniker-Briefe',
    tableName: 'UserNotification',
    filterField: 'user_email'
  },
  {
    key: 'quests',
    name: '🗺️ Forschungsaufträge',
    tableName: 'UserQuest',
    filterField: 'created_by'
  },
  {
    key: 'weeklyQuests',
    name: '🌱 Wöchentliche Feldaufgaben',
    tableName: 'UserWeeklyQuest',
    filterField: 'created_by'
  },
  {
    key: 'monthlyQuests',
    name: '🌾 Monatliche Erntequoten',
    tableName: 'UserMonthlyQuest',
    filterField: 'created_by'
  },
  {
    key: 'friends',
    name: '👣 Forscher-Kollegen',
    tableName: 'Friend',
    filterField: 'created_by'
  },
  {
    key: 'sharedScans',
    name: '🔬 Geteilte Beobachtungen',
    tableName: 'SharedScan',
    filterField: null // Special handling
  },
  {
    key: 'scanLikes',
    name: '⭐ Lieblingsfunde',
    tableName: 'ScanLike',
    filterField: 'created_by'
  }
];

/**
 * Complete migration: Create Supabase Auth user with password
 * and link to legacy baseUser record via auth_id
 * 
 * @param {string} email - User email
 * @param {string} password - New password
 * @param {Function} onProgress - Callback function called with each step: onProgress({ step, completed, total })
 */
export const completeMigration = async (email, password, onProgress) => {
  // Check if email is verified in migration process
  const verifiedEmail = localStorage.getItem('migration_verified_email');
  if (verifiedEmail !== email) {
    throw new Error('Email nicht verifiziert. Bitte starten Sie erneut.');
  }

  try {
    console.log('[completeMigration] Starting for email:', email);
    
    // Get the verified auth user (already created by signInWithOtp + verifyOtp)
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      console.error('[completeMigration] Auth user not found:', authError);
      throw new Error('Authentifizierung fehlgeschlagen. Bitte versuchen Sie es erneut.');
    }

    const userId = authData.user.id;
    console.log('[completeMigration] Auth user ID:', userId);

    // Update password for this user
    const { error: updateError } = await supabase.auth.updateUser({
      password: password
    });

    if (updateError) {
      console.error('[completeMigration] Password update failed:', updateError);
      throw updateError;
    }
    console.log('[completeMigration] Password updated successfully');

    // Ensure a valid session by signing in with the new password
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (signInError) {
      console.error('[completeMigration] Sign-in after password update failed:', signInError);
      throw signInError;
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session?.access_token) {
      console.error('[completeMigration] Session not available after sign-in:', sessionError);
      throw new Error('Session nicht verfuegbar. Bitte erneut anmelden.');
    }

    // Get legacy user ID from localStorage
    const legacyUserId = localStorage.getItem('migration_legacy_user_id');
    console.log('[completeMigration] Legacy user ID:', legacyUserId);

    if (!legacyUserId) {
      throw new Error('Legacy User ID fehlt. Bitte starten Sie die Migration erneut.');
    }

    // Server-side migration via Edge Function (bypasses RLS safely)
    const { data: migrationData, error: migrationError } = await supabase.functions.invoke(
      'migrateLegacyUser',
      {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`
        },
        body: {
          legacyUserId
        }
      }
    );

    if (migrationError) {
      console.error('[completeMigration] Edge migration failed:', migrationError);
      throw migrationError;
    }

    const resultSteps = migrationData?.results || [];
    if (onProgress) {
      const total = resultSteps.length || MIGRATION_STEPS.length;

      if (resultSteps.length > 0) {
        resultSteps.forEach((result, index) => {
          const step = MIGRATION_STEPS.find((s) => s.key === result.key) || {
            key: result.key,
            name: result.name || result.key
          };

          onProgress({
            step,
            completed: index + 1,
            total,
            percentage: Math.round(((index + 1) / total) * 100),
            updated: result.updated
          });
        });
      } else {
        MIGRATION_STEPS.forEach((step, index) => {
          onProgress({
            step,
            completed: index + 1,
            total,
            percentage: Math.round(((index + 1) / total) * 100)
          });
        });
      }
    }

    console.log('[completeMigration] All user tables linked successfully (Edge Function).');

    // Clear migration data from localStorage
    localStorage.removeItem('migration_email');
    localStorage.removeItem('migration_legacy_user_id');
    localStorage.removeItem('migration_verified_email');
    localStorage.removeItem('migration_verified_at');

    return { success: true, userId };
  } catch (err) {
    console.error('[completeMigration] FAILED:', err);
    throw err;
  }
};

/**
 * Get legacy user profile data after successful migration
 */
export const getLegacyUserProfile = async (email) => {
  const { data, error } = await supabase
    .from('baseUser')
    .select('*')
    .eq('email', email)
    .single();

  if (error) throw error;
  return data;
};

/**
 * Execute migration via Edge Function (called AFTER user is on Home page)
 * This assumes the user is already signed in with a valid session
 * 
 * @param {Function} onProgress - Callback function called with each step
 */
export const executeMigration = async (onProgress) => {
  try {
    console.log('[executeMigration] Starting migration via Edge Function...');

    // Get legacy user ID and email from localStorage
    const legacyUserId = localStorage.getItem('migration_legacy_user_id');
    const email = localStorage.getItem('migration_email');
    
    console.log('[executeMigration] Legacy user ID:', legacyUserId);
    console.log('[executeMigration] Email:', email);

    if (!legacyUserId) {
      throw new Error('Legacy User ID fehlt. Bitte starten Sie die Migration erneut.');
    }

    if (!email) {
      throw new Error('Email fehlt. Bitte starten Sie die Migration erneut.');
    }

    // Server-side migration via Edge Function (public endpoint with internal validation)
    console.log('[executeMigration] Invoking migrateLegacyUser Edge Function...');
    const { data: migrationData, error: migrationError } = await supabase.functions.invoke(
      'migrateLegacyUser',
      {
        body: {
          email,
          legacyUserId
        }
      }
    );

    if (migrationError) {
      console.error('[executeMigration] Edge migration failed:', migrationError);
      throw migrationError;
    }

    console.log('[executeMigration] Migration successful:', migrationData);

    const resultSteps = migrationData?.results || [];
    if (onProgress) {
      const total = resultSteps.length || MIGRATION_STEPS.length;

      if (resultSteps.length > 0) {
        resultSteps.forEach((result, index) => {
          const step = MIGRATION_STEPS.find((s) => s.key === result.key) || {
            key: result.key,
            name: result.name || result.key
          };

          onProgress({
            step,
            completed: index + 1,
            total,
            percentage: Math.round(((index + 1) / total) * 100),
            updated: result.updated
          });
        });
      }
    }

    console.log('[executeMigration] All user tables linked successfully.');

    // Clear migration data from localStorage
    localStorage.removeItem('migration_email');
    localStorage.removeItem('migration_legacy_user_id');
    localStorage.removeItem('migration_verified_email');
    localStorage.removeItem('migration_verified_at');
    localStorage.removeItem('migration_pending');

    return { success: true, results: resultSteps };
  } catch (err) {
    console.error('[executeMigration] FAILED:', err);
    // Don't clear the pending flag so user can retry
    throw err;
  }
};

