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
 * Complete migration: Create Supabase Auth user with password
 * and link to legacy baseUser record via auth_id
 */
export const completeMigration = async (email, password) => {
  // Check if email is verified in migration process
  const verifiedEmail = localStorage.getItem('migration_verified_email');
  if (verifiedEmail !== email) {
    throw new Error('Email nicht verifiziert. Bitte starten Sie erneut.');
  }

  try {
    // Get the verified auth user (already created by signInWithOtp + verifyOtp)
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      throw new Error('Authentifizierung fehlgeschlagen. Bitte versuchen Sie es erneut.');
    }

    const userId = authData.user.id;

    // Update password for this user
    const { error: updateError } = await supabase.auth.updateUser({
      password: password
    });

    if (updateError) throw updateError;

    // Get legacy user ID from localStorage
    const legacyUserId = localStorage.getItem('migration_legacy_user_id');

    // Link legacy user to auth user via auth_id
    const { error: linkError } = await supabase
      .from('baseUser')
      .update({ auth_id: userId })
      .eq('id', legacyUserId);

    if (linkError) throw linkError;

    // ✅ MIGRATION: Link all user-related tables with auth_id
    console.log('[Migration] Linking all user tables with auth_id:', userId, 'for email:', email);
    
    // PublicProfile
    await supabase
      .from('PublicProfile')
      .update({ auth_id: userId })
      .eq('user_email', email);

    // UserPlantDiscovery (uses "user" column)
    await supabase
      .from('UserPlantDiscovery')
      .update({ auth_id: userId })
      .eq('user', email);

    // UserNotification
    await supabase
      .from('UserNotification')
      .update({ auth_id: userId })
      .eq('user_email', email);

    // UserQuest (uses created_by)
    await supabase
      .from('UserQuest')
      .update({ auth_id: userId })
      .eq('created_by', email);

    // UserWeeklyQuest
    await supabase
      .from('UserWeeklyQuest')
      .update({ auth_id: userId })
      .eq('created_by', email);

    // UserMonthlyQuest
    await supabase
      .from('UserMonthlyQuest')
      .update({ auth_id: userId })
      .eq('created_by', email);

    // Friend
    await supabase
      .from('Friend')
      .update({ auth_id: userId })
      .eq('user_email', email);

    // SharedScan (has both shared_by and shared_to)
    await supabase
      .from('SharedScan')
      .update({ auth_id_from: userId })
      .eq('shared_by', email);
      
    await supabase
      .from('SharedScan')
      .update({ auth_id_to: userId })
      .eq('shared_to', email);

    // ScanLike
    await supabase
      .from('ScanLike')
      .update({ auth_id: userId })
      .eq('user_email', email);

    console.log('[Migration] All user tables linked successfully!');

    // Clear migration data from localStorage
    localStorage.removeItem('migration_email');
    localStorage.removeItem('migration_legacy_user_id');
    localStorage.removeItem('migration_verified_email');
    localStorage.removeItem('migration_verified_at');

    return { success: true, userId };
  } catch (err) {
    console.error('Migration completion error:', err);
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
