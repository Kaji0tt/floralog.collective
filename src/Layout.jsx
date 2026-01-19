import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import NotificationManager from "./components/notifications/NotificationManager";
import ToastNotificationManager from "./components/notifications/ToastNotificationManager";
import QuestNotificationManager from "./components/quests/QuestNotificationManager";
import UserNotificationManager from "./components/notifications/UserNotificationManager";
import WelcomeNameDialog from "./components/onboarding/WelcomeNameDialog";
import { Toaster } from "@/components/ui/toaster";



export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const [user, setUser] = useState(null);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    } catch (error) {
      console.log("User not authenticated");
    }
  };

  useEffect(() => {
    loadUser();
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

      {/* Quest Notifications */}
      {user && <QuestNotificationManager user={user} />}

      {/* User Notifications System */}
      {user && <UserNotificationManager user={user} />}

      {/* Welcome Dialog für neue Nutzer */}
      {user && <WelcomeNameDialog user={user} onComplete={loadUser} />}

      <Toaster />
    </>
  );
}