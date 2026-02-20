// Migration Service - handles legacy user migration to Supabase Auth with 2FA

import { supabase } from './supabaseClient';

/**
 * Check if user exists in legacy "baseUser" table
 */
export const checkLegacyUser = async (email) => {
  const { data, error } = await supabase
    .from('baseUser')
    .select('*')
    .eq('email', email)
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
      shouldCreateUser: true
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

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session?.access_token) {
      console.error('[executeMigration] Session not available:', sessionError);
      throw new Error('Session nicht verfügbar. Bitte erneut anmelden.');
    }

    // Get legacy user ID from localStorage
    const legacyUserId = localStorage.getItem('migration_legacy_user_id');
    console.log('[executeMigration] Legacy user ID:', legacyUserId);

    if (!legacyUserId) {
      throw new Error('Legacy User ID fehlt. Bitte starten Sie die Migration erneut.');
    }

    // Server-side migration via Edge Function (bypasses RLS safely)
    console.log('[executeMigration] Invoking migrateLegacyUser Edge Function...');
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

