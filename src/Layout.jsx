import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Query } from "@/api/entities";
import { getCurrentUser } from "@/api/userApi";
import NotificationManager from "./components/notifications/NotificationManager";
import ToastNotificationManager from "./components/notifications/ToastNotificationManager";
import QuestNotificationManager from "./components/quests/QuestNotificationManager";
import UserNotificationManager from "./components/notifications/UserNotificationManager";
import QuestAutoAccepter from "./components/quests/QuestAutoAccepter";
import { Toaster } from "@/components/ui/toaster";



export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const [user, setUser] = useState(null);

  const loadUser = async () => {
    try {
      console.log("[Layout] Lade User-Daten...");
      const currentUser = await getCurrentUser();
      console.log("[Layout] User geladen:", {
        email: currentUser.email,
        display_name: currentUser.display_name,
        full_name: currentUser.full_name
      });
      setUser(currentUser);
      console.log("[Layout] User State aktualisiert");
      
      // Trigger Custom Event für andere Komponenten (z.B. Home)
      console.log("[Layout] Triggere userUpdated Event");
      window.dispatchEvent(new CustomEvent('userUpdated', { detail: currentUser }));
    } catch (error) {
      console.log("[Layout] User nicht authentifiziert:", error);
    }
  };

  useEffect(() => {
    loadUser();
    
    // Referral-Code aus URL extrahieren und speichern
    const urlParams = new URLSearchParams(window.location.search);
    const referralCode = urlParams.get('ref');
    if (referralCode) {
      localStorage.setItem('referral_code', referralCode);
      console.log('[Referral] Code gespeichert:', referralCode);
      // Entferne den Code aus der URL
      window.history.replaceState({}, document.title, window.location.pathname);
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

      <Toaster />
    </>
  );
}
