import './App.css'
import { useEffect } from 'react'
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import VisualEditAgent from '@/lib/VisualEditAgent'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Register from '@/pages/Register';
import ConfirmEmail from '@/pages/ConfirmEmail';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import GuestPlaytestSignup from '@/pages/GuestPlaytestSignup';
import GuestLoginModal from '@/components/GuestLoginModal';
import ResetPasswordModal from '@/components/ResetPasswordModal';
import HomeShellLoader from '@/components/navigation/HomeShellLoader';
import { UiThemeProvider } from '@/lib/UiThemeContext';
import OtaUpdateManager from '@/components/OtaUpdateManager';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const isMaintenanceModeEnabled =
  String(import.meta.env.VITE_MAINTENANCE_MODE ?? 'false').toLowerCase() === 'true';

const maintenanceTitle =
  import.meta.env.VITE_MAINTENANCE_TITLE || 'Floralog ist voruebergehend nicht verfuegbar';

const maintenanceMessage =
  import.meta.env.VITE_MAINTENANCE_MESSAGE || 'Wir spielen gerade ein Update ein. Bitte versuche es spaeter erneut.';

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

function MaintenanceScreen() {
  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-stone-950 via-stone-900 to-emerald-950 text-stone-100 flex items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-3xl border border-emerald-400/30 bg-stone-900/70 backdrop-blur p-8 text-center shadow-2xl">
        <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-emerald-500/20 border border-emerald-300/40 flex items-center justify-center">
          <span className="text-xl">!</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight mb-3">{maintenanceTitle}</h1>
        <p className="text-stone-300 leading-relaxed">{maintenanceMessage}</p>
      </div>
    </div>
  );
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, authError, isAuthenticated, loginModalOpen, closeLoginModal, isPasswordRecovery, clearPasswordRecovery } = useAuth();

  // Show loading spinner while checking auth
  if (isLoadingAuth) {
    return <HomeShellLoader />;
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      return <Navigate to="/login" replace />;
    }
  }

  // Render the main app (guests are allowed to browse)
  return (
    <>
      <GuestLoginModal open={loginModalOpen} onClose={closeLoginModal} />
      <ResetPasswordModal open={isPasswordRecovery} onSuccess={clearPasswordRecovery} />
      <Routes>
        <Route path="/" element={
          <LayoutWrapper currentPageName={mainPageKey}>
            <MainPage />
          </LayoutWrapper>
        } />
        {Object.entries(Pages).map(([path, Page]) => (
          <Route
            key={path}
            path={`/${path}`}
            element={
              <LayoutWrapper currentPageName={path}>
                <Page />
              </LayoutWrapper>
            }
          />
        ))}
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </>
  );
};


/**
 * On native Android/iOS, window-focus events are unreliable for detecting
 * app-resume. We listen to Capacitor's appStateChange instead and invalidate
 * the user-specific unlock queries so the Shop and other features always show
 * fresh state after the app comes back to the foreground.
 */
function CapacitorResumeRefresh() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let handle;
    CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) return;
      queryClientInstance.invalidateQueries({ queryKey: ['userRewards'] });
      queryClientInstance.invalidateQueries({ queryKey: ['homeUserRewards'] });
      queryClientInstance.invalidateQueries({ queryKey: ['userAchievements'] });
      queryClientInstance.invalidateQueries({ queryKey: ['explorerDiscoveriesInfinite'] });
    }).then((l) => { handle = l; });

    return () => { handle?.remove(); };
  }, []);

  return null;
}

function App() {

  if (isMaintenanceModeEnabled) {
    return <MaintenanceScreen />;
  }

  return (
    <UiThemeProvider>
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <CapacitorResumeRefresh />
          <NavigationTracker />
          <Routes>
            <Route path="/guest-playtest" element={<GuestPlaytestSignup />} />

            {/* Public Auth Routes - accessible without authentication */}
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="/register" element={<Register />} />
            <Route path="/confirm-email" element={<ConfirmEmail />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            
            {/* Protected App Routes */}
            <Route path="/*" element={<AuthenticatedApp />} />
          </Routes>
        </Router>
        <Toaster />
        <VisualEditAgent />
        <OtaUpdateManager />
      </QueryClientProvider>
    </AuthProvider>
    </UiThemeProvider>
  )
}

export default App
