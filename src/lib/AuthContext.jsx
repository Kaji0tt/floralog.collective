import React, { createContext, useState, useContext, useEffect } from 'react';

import { 
  onAuthChange, 
  getCurrentAuthUser, 
  getUserProfile, 
  signOut as supabaseSignOut 
} from '@/api/authService';

const getTodayKey = () => new Date().toISOString().slice(0, 10);
const getZoneGenerationStorageKey = (authId) => `robotPlantZoneDay:${authId}`;
const migrateLegacyUserUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/migrateLegacyUser`;


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
    // Fallback timeout: if auth doesn't respond in 3 seconds, stop loading
    const timeoutId = setTimeout(() => {
      console.log('[AuthContext] Auth timeout - stopping loading state');
      setIsLoadingAuth(false);
    }, 3000);

    // Listen to auth state changes
    const { data: { subscription } } = onAuthChange(async (event, session) => {
      console.log('Auth event:', event);
      clearTimeout(timeoutId); // Clear timeout if auth responds

      // Recovery session: user clicked the password-reset email link.
      // Keep them as guest and show the reset-password modal.
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
        setIsLoadingAuth(false);
        return;
      }
      
      if (session?.user) {
        // User signed in
        setUser(session.user);
        setIsAuthenticated(true);
        const storedZoneDay = localStorage.getItem(getZoneGenerationStorageKey(session.user.id));
        setZoneGenerationDay(storedZoneDay || null);

        // Load user profile
        try {
          const userProfile = await getUserProfile(session.user.id);
          setProfile(userProfile);

          // Migrations-Helper aufrufen
          const baseUser = {
            auth_id: session.user.id,
            email: session.user.email
          };


          // Supabase Edge Function automatisch aufrufen
          // Jetzt mit auth_id und email
          if (baseUser.auth_id && baseUser.email) {
            fetch(migrateLegacyUserUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                // ggf. Authorization-Header ergänzen
              },
              body: JSON.stringify({ email: baseUser.email, auth_id: baseUser.auth_id })
            })
              .then(res => res.json())
              .then(data => {
                console.log('[AuthContext] migrateLegacyUser result:', data);
              })
              .catch(err => {
                console.error('[AuthContext] migrateLegacyUser error:', err);
              });
          }
        } catch (error) {
          console.error('Error loading user profile:', error);
        }
      } else {
        // User signed out
        setUser(null);
        setProfile(null);
        setIsAuthenticated(false);
        setZoneGenerationDay(null);
      }

      setIsLoadingAuth(false);
    });

    // Cleanup subscription on unmount
    return () => {
      clearTimeout(timeoutId);
      subscription?.unsubscribe();
    };
  }, []);

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
