import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

/**
 * Komponente zur Anzeige von Quest-Benachrichtigungen
 * Unterstützt verschiedene Display-Locations: modal, toast, banner
 */
export default function QuestNotificationDisplay({ notification, onClose, onMarkAsSeen }) {
  const navigate = useNavigate();

  if (!notification) return null;

  const handleAction = () => {
    // Markiere als gesehen, aber navigiere NICHT automatisch
    onMarkAsSeen(notification.id);
    onClose();
  };

  // Modal Display (Standard für Quest-Notifications)
  if (notification.display_location === "modal" || !notification.display_location) {
    return (
      <AnimatePresence>
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-start justify-center pt-20 px-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            transition={{ type: "spring", damping: 20 }}
            className="relative w-full max-w-sm mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Content Box */}
            <div className="bg-amber-50 border-4 border-amber-300 rounded-2xl shadow-2xl p-4 max-h-[80vh] overflow-y-auto relative">
              {/* Close Button */}
              <button
                onClick={onClose}
                className="absolute top-3 right-3 w-10 h-10 bg-amber-200 hover:bg-amber-300 rounded-full flex items-center justify-center transition-colors z-10 shadow-lg"
              >
                <X className="w-6 h-6 text-amber-900" />
              </button>

              {/* Notification Title */}
              {notification.title && (
                <h4 className="font-bold text-stone-900 mb-2 text-base pr-8">
                  {notification.title}
                </h4>
              )}
              
              {/* Notification Message */}
              <p className="text-sm text-stone-700 leading-relaxed mb-2">
                {notification.message}
              </p>
              
              {/* Notification Description */}
              {notification.description && (
                <p className="text-xs text-stone-600 mb-2 italic bg-amber-100 p-2 rounded-lg border border-amber-200">
                  {notification.description}
                </p>
              )}

              {/* Action Button - nur schließen, keine Navigation */}
              <button
                onClick={handleAction}
                className="w-full mt-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors text-sm"
              >
                Verstanden
              </button>
            </div>
          </motion.div>
        </div>
      </AnimatePresence>
    );
  }

  // Toast Display
  if (notification.display_location === "toast") {
    return (
      <motion.div
        initial={{ x: 300, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 300, opacity: 0 }}
        className="fixed top-4 right-4 bg-amber-50 border-2 border-amber-300 rounded-lg shadow-xl p-4 max-w-sm z-50"
      >
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-amber-600 hover:text-amber-800"
        >
          <X className="w-4 h-4" />
        </button>
        <h5 className="font-bold text-stone-900 mb-1">{notification.title}</h5>
        <p className="text-sm text-stone-700">{notification.message}</p>
        {notification.action_url && (
          <button
            onClick={handleAction}
            className="mt-2 text-sm text-amber-600 hover:text-amber-800 font-semibold"
          >
            Mehr erfahren →
          </button>
        )}
      </motion.div>
    );
  }

  // Banner Display
  if (notification.display_location === "banner") {
    const parseScanLikedMessage = (message) => {
      const text = String(message || "").trim();
      const match = text.match(/^(.+?)\s+gef[äa]llt\s+dein\s+Scan(?:\s*\((.+?)\))?\.?$/i);
      return {
        actorName: match?.[1]?.trim() || "Jemand",
        scanName: match?.[2]?.trim() || "",
      };
    };

    const isScanLikedNotification = notification.notification_type === "scan_liked";
    const scanLikeParts = isScanLikedNotification ? parseScanLikedMessage(notification.message) : null;

    const handleBannerBodyClick = () => {
      onClose();
      navigate(createPageUrl("Friends?tab=news"));
    };

    const handleActorClick = (e) => {
      e.stopPropagation();
      const actorEmail = String(notification.created_by || "").trim();
      if (!actorEmail || actorEmail === "system") return;
      onClose();
      navigate(createPageUrl(`FriendProfile?email=${encodeURIComponent(actorEmail)}`));
    };

    const handleScanClick = (e) => {
      e.stopPropagation();
      if (!notification.action_url) return;
      onClose();
      navigate(createPageUrl(notification.action_url));
    };

    const handleAnsehenClick = (e) => {
      e.stopPropagation();
      onClose();
      if (notification.action_url) {
        navigate(createPageUrl(notification.action_url));
      }
    };

    return (
      <motion.div
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        exit={{ y: -100 }}
        className="fixed top-0 left-0 right-0 bg-amber-400 text-stone-900 py-3 px-4 z-50 shadow-lg cursor-pointer"
        onClick={handleBannerBodyClick}
      >
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex-1">
            <strong className="font-bold">{notification.title}</strong>
            <span className="ml-2">
              {isScanLikedNotification ? (
                <>
                  <button
                    type="button"
                    onClick={handleActorClick}
                    className={`font-semibold underline underline-offset-2 ${notification.created_by && notification.created_by !== "system" ? "" : "no-underline cursor-default"}`}
                    disabled={!notification.created_by || notification.created_by === "system"}
                  >
                    {scanLikeParts?.actorName || "Jemand"}
                  </button>
                  {' gefällt dein Scan '}
                  {scanLikeParts?.scanName ? (
                    <button
                      type="button"
                      onClick={handleScanClick}
                      className={`font-semibold underline underline-offset-2 ${notification.action_url ? "" : "no-underline cursor-default"}`}
                      disabled={!notification.action_url}
                    >
                      {scanLikeParts.scanName}
                    </button>
                  ) : (
                    <span>diesen Scan</span>
                  )}
                </>
              ) : (
                notification.message
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {notification.action_url && (
              <button
                onClick={handleAnsehenClick}
                className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-1 rounded font-semibold text-sm"
              >
                Ansehen
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="text-stone-900 hover:text-stone-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  return null;
}