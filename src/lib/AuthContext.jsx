import React, { createContext, useState, useContext, useEffect } from 'react';

import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { 
  onAuthChange, 
  getCurrentAuthUser, 
  getUserProfile, 
  ensureUserProfileExists,
  completeNativeOAuthSignIn,
  signOut as supabaseSignOut 
} from '@/api/authService';
import { Query } from '@/api/entities';
import { trackCurrentUserPresence } from '@/api/onlinePresenceService';
import { persistLastSignedInUserSnapshot } from '@/lib/lastSignedInUserStorage';
import { updateCurrentUserProfile } from '@/api/userApi';
import { LOGO_ACCESSORY_DEFAULTS } from '@/lib/logoAccessoryAssets';
import { readGuestLogoCustomizationDraft, clearGuestLogoCustomizationDraft } from '@/lib/guestLogoCustomizationStorage';

const getTodayKey = () => new Date().toISOString().slice(0, 10);
const getZoneGenerationStorageKey = (authId) => `robotPlantZoneDay:${authId}`;

const dispatchUserUpdatedEvent = (detail) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('userUpdated', { detail }));
};


const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // Current auth user
  const [profile, setProfile] = useState(null); // User profile from PublicProfile table
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [zoneGenerationDay, setZoneGenerationDay] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const clearAuthState = () => {
      if (!isMounted) return;
      setUser(null);
      setProfile(null);
      setIsAuthenticated(false);
      setZoneGenerationDay(null);
      dispatchUserUpdatedEvent(null);
    };

    const hydrateAuthenticatedState = async (sessionUser) => {
      if (!sessionUser || !isMounted) return;

      setUser(sessionUser);
      setIsAuthenticated(true);
      const storedZoneDay = localStorage.getItem(getZoneGenerationStorageKey(sessionUser.id));
      setZoneGenerationDay(storedZoneDay || null);

      try {
        let userProfile = await getUserProfile(sessionUser.id);
        if (!userProfile) {
          userProfile = await ensureUserProfileExists(sessionUser);
        }

        if (!isMounted) return;

        const pendingGuestLogoDraft = readGuestLogoCustomizationDraft();
        if (pendingGuestLogoDraft) {
          const profileStillAtDefaults = (
            userProfile?.selected_face_asset === LOGO_ACCESSORY_DEFAULTS.selected_face_asset &&
            userProfile?.selected_border_asset === LOGO_ACCESSORY_DEFAULTS.selected_border_asset &&
            !userProfile?.selected_border_color
          );

          if (profileStillAtDefaults) {
            try {
              const updatedProfile = await updateCurrentUserProfile({
                selected_face_asset: pendingGuestLogoDraft.selected_face_asset,
                selected_border_asset: pendingGuestLogoDraft.selected_border_asset,
                selected_border_color: pendingGuestLogoDraft.selected_border_color ?? null,
              });
              userProfile = { ...userProfile, ...updatedProfile };
            } catch (error) {
              console.error('[AuthContext] Failed to apply guest logo customization draft:', error);
            }
          }

          clearGuestLogoCustomizationDraft();
        }

        setProfile(userProfile);

        const logoAssetsCatalog = await Query.LogoAsset.list();
        persistLastSignedInUserSnapshot({
          authUser: sessionUser,
          profile: userProfile,
          logoAssetsCatalog,
        });

        dispatchUserUpdatedEvent({
          ...sessionUser,
          ...(userProfile || {}),
          id: sessionUser.id,
          auth_id: sessionUser.id,
        });
      } catch (error) {
        console.error('Error loading user profile:', error);
      }
    };

    const bootstrapCurrentSession = async () => {
      try {
        const currentAuthUser = await getCurrentAuthUser();
        if (currentAuthUser) {
          await hydrateAuthenticatedState(currentAuthUser);
        } else {
          clearAuthState();
        }
      } catch (error) {
        console.error('[AuthContext] Session bootstrap failed:', error);
      } finally {
        if (isMounted) {
          setIsLoadingAuth(false);
        }
      }
    };

    // Fallback timeout: if auth doesn't respond in 3 seconds, bootstrap via getCurrentAuthUser.
    const timeoutId = setTimeout(() => {
      console.log('[AuthContext] Auth timeout - running session bootstrap');
      bootstrapCurrentSession();
    }, 3000);

    // Bootstrap once on mount to avoid relying solely on auth events.
    bootstrapCurrentSession();

    // Listen to auth state changes
    const { data: { subscription } } = onAuthChange(async (event, session) => {
      console.log('Auth event:', event);
      clearTimeout(timeoutId); // Clear timeout if auth responds

      // Recovery session: user clicked the password-reset email link.
      // Keep them as guest and show the reset-password modal.
      if (event === 'PASSWORD_RECOVERY') {
        clearAuthState();
        setIsPasswordRecovery(true);
        setIsLoadingAuth(false);
        return;
      }
      
      if (session?.user) {
        await hydrateAuthenticatedState(session.user);
      } else {
        clearAuthState();
      }

      if (isMounted) {
        setIsLoadingAuth(false);
      }
    });

    // Cleanup subscription on unmount
    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      subscription?.unsubscribe();
    };
  }, []);

  // Native Google login returns here via the floralog://open deep link.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;

    let listenerHandle;

    CapacitorApp.addListener('appUrlOpen', async ({ url }) => {
      if (!url?.startsWith('floralog://open')) return;
      try {
        await completeNativeOAuthSignIn(url);
      } catch (error) {
        console.error('[AuthContext] Native OAuth completion failed:', error);
      }
    }).then((handle) => {
      listenerHandle = handle;
    });

    return () => {
      listenerHandle?.remove();
    };
  }, []);

  useEffect(() => {
    if (!user?.id) return undefined;

    return trackCurrentUserPresence({
      authUser: user,
      profile,
    });
  }, [
    user?.id,
    user?.email,
    profile?.display_name,
    profile?.full_name,
    profile?.selected_title,
    profile?.title,
  ]);

  const logout = async (shouldRedirect = true) => {
    try {
      if (user?.id) {
        localStorage.removeItem(getZoneGenerationStorageKey(user.id));
      }
      await supabaseSignOut();
      setUser(null);
      setProfile(null);
      setIsAuthenticated(false);
      setZoneGenerationDay(null);
      
      if (shouldRedirect) {
        window.location.href = '/';
      }
    } catch (error) {
      console.error('Logout error:', error);
      setAuthError({
        type: 'logout_error',
        message: error.message
      });
    }
  };

  const navigateToLogin = () => {
    window.location.href = '/login';
  };

  const updateProfile = (newProfile) => {
    setProfile(newProfile);
  };

  const openLoginModal = () => {
    setLoginModalOpen(true);
  };

  const closeLoginModal = () => {
    setLoginModalOpen(false);
  };

  const clearPasswordRecovery = () => {
    setIsPasswordRecovery(false);
  };

  const setZoneGenerationDayForUser = (dayKey) => {
    if (!user?.id || !dayKey) return;
    localStorage.setItem(getZoneGenerationStorageKey(user.id), dayKey);
    setZoneGenerationDay(dayKey);
  };

  const clearZoneGenerationDayForUser = () => {
    if (!user?.id) return;
    localStorage.removeItem(getZoneGenerationStorageKey(user.id));
    setZoneGenerationDay(null);
  };

  const hasCalledZoneGenerationToday = zoneGenerationDay === getTodayKey();

  /**
   * Require authentication. If the user is not authenticated, open the login modal
   * and return false. Otherwise return true.
   */
  const requireAuth = () => {
    if (!isAuthenticated) {
      openLoginModal();
      return false;
    }
    return true;
  };

  return (
    <AuthContext.Provider value={{ 
      user,
      profile,
      isAuthenticated, 
      isLoadingAuth,
      authError,
      logout,
      navigateToLogin,
      updateProfile,
      loginModalOpen,
      openLoginModal,
      closeLoginModal,
      requireAuth,
      isPasswordRecovery,
      clearPasswordRecovery,
      zoneGenerationDay,
      hasCalledZoneGenerationToday,
      setZoneGenerationDayForUser,
      clearZoneGenerationDayForUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
