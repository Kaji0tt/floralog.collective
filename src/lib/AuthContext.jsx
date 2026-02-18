import React, { createContext, useState, useContext, useEffect } from 'react';
import { 
  onAuthChange, 
  getCurrentAuthUser, 
  getUserProfile, 
  signOut as supabaseSignOut 
} from '@/api/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // Current auth user
  const [profile, setProfile] = useState(null); // User profile from PublicProfile table
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    // Listen to auth state changes
    const { data: { subscription } } = onAuthChange(async (event, session) => {
      console.log('Auth event:', event);
      
      if (session?.user) {
        // User signed in
        setUser(session.user);
        setIsAuthenticated(true);
        
        // Load user profile
        try {
          const userProfile = await getUserProfile(session.user.email);
          setProfile(userProfile);
        } catch (error) {
          console.error('Error loading user profile:', error);
        }
      } else {
        // User signed out
        setUser(null);
        setProfile(null);
        setIsAuthenticated(false);
      }
      
      setIsLoadingAuth(false);
    });

    // Cleanup subscription on unmount
    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const logout = async (shouldRedirect = true) => {
    try {
      await supabaseSignOut();
      setUser(null);
      setProfile(null);
      setIsAuthenticated(false);
      
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

  return (
    <AuthContext.Provider value={{ 
      user,
      profile,
      isAuthenticated, 
      isLoadingAuth,
      authError,
      logout,
      navigateToLogin,
      updateProfile
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
