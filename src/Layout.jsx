import { useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { encodeReferralCode } from "@/lib/referralCode";
import NotificationManager from "./components/notifications/NotificationManager";
import ToastNotificationManager from "./components/notifications/ToastNotificationManager";
import UserNotificationManager from "./components/notifications/UserNotificationManager";
import WeeklyRankingResultModal from "./components/notifications/WeeklyRankingResultModal";
import QuestAutoAccepter from "./components/quests/QuestAutoAccepter";
import { Toaster } from "@/components/ui/toaster";



export default function Layout({ children, currentPageName }) {
  const { user: authUser, profile } = useAuth();
  const user = authUser
    ? { ...authUser, ...(profile || {}), id: authUser.id, auth_id: authUser.id }
    : null;

  useEffect(() => {
    // Referral-Code aus URL extrahieren und speichern
    const urlParams = new URLSearchParams(window.location.search);
    const referralCode = urlParams.get('ref');
    console.log('[Referral] Layout-Init - window.location:', {
      href: window.location.href,
      search: window.location.search,
      referralCode,
      searchParams: Array.from(urlParams.entries()),
    });
    if (referralCode) {
      const normalizedReferralCode = referralCode.includes('@')
        ? encodeReferralCode(referralCode)
        : referralCode;
      localStorage.setItem('referral_code', normalizedReferralCode);
      console.log('[Referral] Code gespeichert im localStorage:', {
        original: referralCode,
        normalized: normalizedReferralCode,
        includesAt: referralCode.includes('@'),
      });
      // Entferne den Code aus der URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      console.log('[Referral] Kein referral_code in URL gefunden');
    }

  }, []);

  return (
    <>
      <style>{`
        body {
          overflow-x: hidden;
        }

        /* Hide scrollbar for snap scroll */
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
      <div className="min-h-screen w-full overflow-x-hidden">
        <main className="flex-1 flex flex-col overflow-x-hidden bg-transparent">
          <div className="flex-1 overflow-auto overflow-x-hidden bg-transparent">
            {children}
          </div>
        </main>
      </div>

      {/* Notification Manager - nur Banner, kein Button */}
      {user && currentPageName !== "Profile" && <NotificationManager user={user} />}

      {/* Toast Notifications */}
      {user && <ToastNotificationManager user={user} />}

      {/* Quest Notifications - DEAKTIVIERT: Nur für Weekly/Monthly Quest-Rotationen verwenden, NICHT für Custom User Notifications! 
          Custom Notifications werden über UserNotificationManager verwaltet. */}
      {/* {user && <QuestNotificationManager user={user} />} */}

      {/* User Notifications System - Hauptsystem für alle benutzerdefinierten Notifications (Onboarding, Quest-Completion, etc.) */}
      {user && currentPageName === "Home" && <UserNotificationManager user={user} />}

      {/* Quest Auto-Accepter */}
      {user && <QuestAutoAccepter user={user} />}

      {/* Weekly ranking result modal - opened via notification actionUrl, works on any page */}
      {user && <WeeklyRankingResultModal user={user} />}

      <Toaster />
    </>
  );
}
