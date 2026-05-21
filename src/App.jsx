import { useEffect, useState } from 'react'
import './App.css'
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import VisualEditAgent from '@/lib/VisualEditAgent'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Register from '@/pages/Register';
import ConfirmEmail from '@/pages/ConfirmEmail';
import MigrateLogin from '@/pages/MigrateLogin';
import SetPassword from '@/pages/SetPassword';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import GuestLoginModal from '@/components/GuestLoginModal';
import ResetPasswordModal from '@/components/ResetPasswordModal';
import HomeShellLoader from '@/components/navigation/HomeShellLoader';
import { UiThemeProvider } from '@/lib/UiThemeContext';
import OtaUpdateManager from '@/components/OtaUpdateManager';
import { Leaf } from 'lucide-react';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const DESKTOP_BLOCK_BACKGROUND = "radial-gradient(circle at top, rgb(167, 243, 208) 0%, rgb(22, 101, 52) 60%, rgb(10, 30, 18) 100%)";

const isDesktopWebAccessBlocked = () => {
  if (typeof window === "undefined") return false;

  const runtimeWindow = /** @type {any} */ (window);
  if (runtimeWindow.Capacitor?.isNativePlatform?.()) return false;

  const userAgent = navigator.userAgent || "";
  const userAgentData = /** @type {any} */ (navigator.userAgentData);
  const hasMobileUserAgent = userAgentData?.mobile === true
    || /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)
    || /iPad|Tablet|PlayBook|Silk/i.test(userAgent);

  const hasTouchPoints = (navigator.maxTouchPoints || 0) > 1;
  const hasCoarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches
    || window.matchMedia?.("(any-pointer: coarse)")?.matches
    || false;
  const hasNoHoverPointer = window.matchMedia?.("(hover: none)")?.matches
    || window.matchMedia?.("(any-hover: none)")?.matches
    || false;
  const shorterViewportEdge = Math.min(window.innerWidth, window.innerHeight);
  const looksLikeTabletInDesktopMode = hasTouchPoints && hasCoarsePointer && hasNoHoverPointer && shorterViewportEdge <= 1366;

  return !(hasMobileUserAgent || looksLikeTabletInDesktopMode);
};

const DesktopAccessBlockedScreen = () => (
  <div className="fixed inset-0 overflow-hidden">
    <div className="absolute inset-0" style={{ background: DESKTOP_BLOCK_BACKGROUND }} />
    <div className="absolute inset-0 backdrop-blur-3xl" />

    <div className="relative z-10 flex h-full w-full items-center justify-center p-3 md:p-6">
      <div className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-emerald-100/25 bg-[linear-gradient(180deg,rgba(10,24,16,0.95)_0%,rgba(6,16,10,0.96)_100%)] p-8 text-stone-100 shadow-[0_28px_90px_rgba(0,0,0,0.62)] backdrop-blur-xl">
        <div className="absolute inset-0 rounded-[2rem] border border-emerald-100/10 pointer-events-none" />
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-200/20 bg-emerald-900/40">
            <Leaf className="h-7 w-7 text-emerald-200" />
          </div>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.28em] text-emerald-100/70">Floralog</p>
          <h1 className="mt-3 text-2xl font-semibold text-emerald-50">Danke für dein Interesse!</h1>
          <p className="mt-3 text-sm leading-relaxed text-emerald-50/90">
            Floralog ist aktuell für die mobile Nutzung gedacht.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-stone-300">
            Bitte öffne die App auf deinem Smartphone oder Tablet, damit wir dich willkommen heißen können.
          </p>
        </div>
      </div>
    </div>
  </div>
);

const DesktopAccessGate = ({ children }) => {
  const [isDesktopBlocked, setIsDesktopBlocked] = useState(() => isDesktopWebAccessBlocked());

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const updateAccess = () => {
      setIsDesktopBlocked(isDesktopWebAccessBlocked());
    };

    const mediaQueries = [
      window.matchMedia?.("(pointer: coarse)"),
      window.matchMedia?.("(any-pointer: coarse)"),
      window.matchMedia?.("(hover: none)"),
      window.matchMedia?.("(any-hover: none)"),
    ].filter(Boolean);

    updateAccess();
    window.addEventListener("resize", updateAccess);
    window.addEventListener("orientationchange", updateAccess);

    mediaQueries.forEach((query) => {
      if (query.addEventListener) {
        query.addEventListener("change", updateAccess);
      } else if (query.addListener) {
        query.addListener(updateAccess);
      }
    });

    return () => {
      window.removeEventListener("resize", updateAccess);
      window.removeEventListener("orientationchange", updateAccess);
      mediaQueries.forEach((query) => {
        if (query.removeEventListener) {
          query.removeEventListener("change", updateAccess);
        } else if (query.removeListener) {
          query.removeListener(updateAccess);
        }
      });
    };
  }, []);

  if (isDesktopBlocked) {
    return <DesktopAccessBlockedScreen />;
  }

  return children;
};

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isLoadingAuth, authError, loginModalOpen, closeLoginModal, isPasswordRecovery, clearPasswordRecovery } = useAuth();

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


function App() {

  return (
    <UiThemeProvider>
      <DesktopAccessGate>
        <AuthProvider>
          <QueryClientProvider client={queryClientInstance}>
            <Router>
              <NavigationTracker />
              <Routes>
                {/* Public Auth Routes - accessible without authentication */}
                <Route path="/login" element={<Navigate to="/" replace />} />
                <Route path="/register" element={<Register />} />
                <Route path="/confirm-email" element={<ConfirmEmail />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/migrate" element={<MigrateLogin />} />
                <Route path="/migration/login" element={<MigrateLogin />} />
                <Route path="/migration/set-password" element={<SetPassword />} />
                
                {/* Protected App Routes */}
                <Route path="/*" element={<AuthenticatedApp />} />
              </Routes>
            </Router>
            <Toaster />
            <VisualEditAgent />
            <OtaUpdateManager />
          </QueryClientProvider>
        </AuthProvider>
      </DesktopAccessGate>
    </UiThemeProvider>
  )
}

export default App
