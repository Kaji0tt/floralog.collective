import { useState, useEffect } from "react";
import { updateCurrentUserProfile, getCurrentUser } from "@/api/userApi";
import { upsertUserProfile, updateEmail, updatePassword } from "@/api/authService";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  LogOut, Mail, Heart, FileText,
  Edit2, CheckCircle, X, Trash2, Sun, Loader2, ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import NotificationManager from "@/components/notifications/NotificationManager";
import LocationManager from "@/components/notifications/LocationManager";
import { useUiTheme } from "@/lib/UiThemeContext";
import { useAuth } from "@/lib/AuthContext";

const DISCOVERY_MARKER_SCALE_MIN = 0.5;
const DISCOVERY_MARKER_SCALE_MAX = 1.0;
const DISCOVERY_MARKER_SCALE_DEFAULT = 0.8;

const clampDiscoveryMarkerScale = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DISCOVERY_MARKER_SCALE_DEFAULT;
  return Math.min(DISCOVERY_MARKER_SCALE_MAX, Math.max(DISCOVERY_MARKER_SCALE_MIN, numeric));
};

export default function SettingsPanel({
  user,
  onUserUpdated,
  discoveryMarkerScale = DISCOVERY_MARKER_SCALE_DEFAULT,
  onDiscoveryMarkerScaleChange,
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { uiTheme, setUiTheme } = useUiTheme();
  const { logout } = useAuth();
  const [impressumOpen, setImpressumOpen] = useState(false);

  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(user?.display_name || user?.full_name || "");
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [editedEmail, setEditedEmail] = useState(user?.email || "");
  const [emailNotice, setEmailNotice] = useState(null);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordNotice, setPasswordNotice] = useState(null);

  useEffect(() => {
    if (!isEditingName) {
      setEditedName(user?.display_name || user?.full_name || "");
    }
  }, [user?.display_name, user?.full_name, isEditingName]);

  useEffect(() => {
    if (!isEditingEmail) {
      setEditedEmail(user?.email || "");
    }
  }, [user?.email, isEditingEmail]);

  const updateUserMutation = useMutation({
    mutationFn: (data) => updateCurrentUserProfile(data),
    onSuccess: async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      const freshUser = await getCurrentUser();
      onUserUpdated?.(freshUser);
      setIsEditingName(false);
      queryClient.invalidateQueries({ queryKey: ["user"] });
      await updatePublicProfile(freshUser);
    },
    onError: (error) => {
      console.error("Fehler beim Update:", error);
      alert(`Fehler beim Speichern: ${error.message}`);
      setIsEditingName(false);
    },
  });

  const updateUiThemeMutation = useMutation({
    mutationFn: (theme) => upsertUserProfile(user?.id, { ui_theme: theme }),
  });

  const updateEmailMutation = useMutation({
    mutationFn: (nextEmail) => updateEmail(nextEmail),
    onSuccess: async (_data, nextEmail) => {
      setEmailNotice({
        type: "success",
        message: `Bitte bestaetige die Aenderung ueber den Link in ${nextEmail}.`,
      });
      setIsEditingEmail(false);
      const freshUser = await getCurrentUser();
      onUserUpdated?.(freshUser);
      queryClient.invalidateQueries({ queryKey: ["user"] });
    },
    onError: (error) => {
      setEmailNotice({
        type: "error",
        message: error?.message || "E-Mail konnte nicht aktualisiert werden.",
      });
    },
  });

  const updatePasswordMutation = useMutation({
    mutationFn: (nextPassword) => updatePassword(nextPassword),
  });

  const updatePublicProfile = async (userData) => {
    try {
      await upsertUserProfile(userData.id, {
        user_email: userData.email,
        display_name: userData.display_name || userData.full_name,
        full_name: userData.full_name,
        title: userData.title,
        selected_title: userData.selected_title,
        background_image_url: userData.background_image_url,
        background_color: userData.background_color,
        global_explorer_visibility: userData.global_explorer_visibility,
      });
    } catch (error) {
      console.error("Fehler beim PublicProfile Update:", error);
    }
  };

  const handleSaveName = async () => {
    const trimmed = editedName.trim();
    if (!trimmed) {
      alert("Bitte gib einen Namen ein.");
      return;
    }
    const current = user?.display_name || user?.full_name;
    if (trimmed === current) {
      setIsEditingName(false);
      return;
    }
    await updateUserMutation.mutateAsync({ display_name: trimmed });
  };

  const handleSaveEmail = async () => {
    const trimmed = editedEmail.trim().toLowerCase();
    const currentEmail = (user?.email || "").trim().toLowerCase();

    if (!trimmed || !/^\S+@\S+\.\S+$/.test(trimmed)) {
      setEmailNotice({ type: "error", message: "Bitte gib eine gueltige E-Mail-Adresse ein." });
      return;
    }

    if (trimmed === currentEmail) {
      setIsEditingEmail(false);
      setEmailNotice(null);
      return;
    }

    setEmailNotice(null);
    await updateEmailMutation.mutateAsync(trimmed);
  };

  const handlePasswordDialogOpenChange = (open) => {
    setChangePasswordOpen(open);
    if (!open) {
      setNewPassword("");
      setConfirmNewPassword("");
      setPasswordNotice(null);
    }
  };

  const handleChangePassword = async () => {
    const trimmed = newPassword.trim();

    if (trimmed.length < 8) {
      setPasswordNotice({
        type: "error",
        message: "Passwort muss mindestens 8 Zeichen lang sein.",
      });
      return;
    }

    if (!/[a-z]/.test(trimmed) || !/[A-Z]/.test(trimmed) || !/\d/.test(trimmed)) {
      setPasswordNotice({
        type: "error",
        message: "Passwort muss Klein-, Grossbuchstaben und Zahlen enthalten.",
      });
      return;
    }

    if (trimmed !== confirmNewPassword) {
      setPasswordNotice({
        type: "error",
        message: "Passwoerter stimmen nicht ueberein.",
      });
      return;
    }

    try {
      setPasswordNotice(null);
      await updatePasswordMutation.mutateAsync(trimmed);
      setPasswordNotice({
        type: "success",
        message: "Passwort erfolgreich geaendert.",
      });
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (error) {
      setPasswordNotice({
        type: "error",
        message: error?.message || "Passwort konnte nicht aktualisiert werden.",
      });
    }
  };

  const getDisplayName = () => user?.display_name || user?.full_name || "Spieler";
  const isAdmin = String(user?.role || "").trim().toLowerCase() === "admin";
  const safeDiscoveryMarkerScale = clampDiscoveryMarkerScale(discoveryMarkerScale);

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <Dialog open={changePasswordOpen} onOpenChange={handlePasswordDialogOpenChange}>
        <DialogContent className={`max-w-md border ${
          uiTheme === 'light'
            ? 'bg-white text-stone-800 border-[#c8ac62]/40'
            : 'bg-[#121b16] border-[#f0e5a5]/35 text-stone-100'
        }`}>
          <DialogHeader>
            <DialogTitle className={uiTheme === 'light' ? 'text-stone-800' : 'text-stone-100'}>
              Passwort aendern
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <p className={`text-xs mb-1 ${uiTheme === 'light' ? 'text-stone-600' : 'text-stone-400'}`}>
                Neues Passwort
              </p>
              <Input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="Neues Passwort"
                autoComplete="new-password"
                className={uiTheme === 'light'
                  ? 'bg-stone-100/40 border-[#c8ac62]/25 text-stone-800 placeholder:text-stone-500'
                  : 'bg-black/30 border-[#f0e5a5]/25 text-stone-100 placeholder:text-stone-400'}
              />
            </div>

            <div>
              <p className={`text-xs mb-1 ${uiTheme === 'light' ? 'text-stone-600' : 'text-stone-400'}`}>
                Passwort bestaetigen
              </p>
              <Input
                type="password"
                value={confirmNewPassword}
                onChange={(event) => setConfirmNewPassword(event.target.value)}
                placeholder="Passwort bestaetigen"
                autoComplete="new-password"
                className={uiTheme === 'light'
                  ? 'bg-stone-100/40 border-[#c8ac62]/25 text-stone-800 placeholder:text-stone-500'
                  : 'bg-black/30 border-[#f0e5a5]/25 text-stone-100 placeholder:text-stone-400'}
              />
            </div>

            <p className={`text-[11px] leading-snug ${uiTheme === 'light' ? 'text-stone-600' : 'text-stone-400'}`}>
              Anforderungen: Mindestens 8 Zeichen, Klein-/Grossbuchstaben und Zahlen.
            </p>

            {passwordNotice && (
              <p className={`text-xs leading-snug ${
                passwordNotice.type === 'error'
                  ? 'text-red-400'
                  : (uiTheme === 'light' ? 'text-green-700' : 'text-green-300')
              }`}>
                {passwordNotice.message}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => handlePasswordDialogOpenChange(false)}
                disabled={updatePasswordMutation.isPending}
                className={`px-3 py-1.5 text-sm rounded-lg border ${
                  uiTheme === 'light'
                    ? 'border-stone-300 text-stone-700 hover:bg-stone-100'
                    : 'border-stone-600 text-stone-200 hover:bg-white/10'
                }`}
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleChangePassword}
                disabled={updatePasswordMutation.isPending}
                className="px-3 py-1.5 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {updatePasswordMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Passwort speichern
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className={`flex-1 min-h-0 overflow-y-auto rounded-3xl border backdrop-blur-sm ${
        uiTheme === 'light'
          ? 'border-[#c0a860]/30 bg-white/40'
          : 'border-[#f0e5a5]/25 bg-black/25'
      }`}>
        <div className="px-3 py-3 space-y-2">
          <p className={`text-[10px] uppercase tracking-widest px-1 ${uiTheme === 'light' ? 'text-stone-600' : 'text-stone-500'}`}>Profil</p>

          <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${
            uiTheme === 'light'
              ? 'bg-stone-100/20 border-[#c8ac62]/15'
              : 'bg-white/5 border-[#f0e5a5]/10'
          }`}>
            <div className="flex-1 min-w-0">
              {isEditingName ? (
                <div className="flex items-center gap-1.5">
                  <Input
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    className={`h-7 text-sm px-2 ${
                      uiTheme === 'light'
                        ? 'bg-stone-100/50 border-[#c8ac62]/30 text-stone-800 placeholder:text-stone-500'
                        : 'bg-black/30 border-[#f0e5a5]/30 text-stone-100 placeholder:text-stone-400'
                    }`}
                    maxLength={50}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveName();
                      if (e.key === "Escape") {
                        setIsEditingName(false);
                        setEditedName(user?.display_name || user?.full_name || "");
                      }
                    }}
                    autoFocus
                  />
                  <button
                    onClick={handleSaveName}
                    disabled={updateUserMutation.isPending}
                    className="w-7 h-7 rounded-lg bg-green-600/70 flex items-center justify-center flex-shrink-0"
                  >
                    <CheckCircle className="w-3.5 h-3.5 text-white" />
                  </button>
                  <button
                    onClick={() => {
                      setIsEditingName(false);
                      setEditedName(user?.display_name || user?.full_name || "");
                    }}
                    className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0"
                  >
                    <X className="w-3.5 h-3.5 text-stone-300" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-sm font-semibold text-stone-100 truncate">{getDisplayName()}</span>
                  <button
                    onClick={() => setIsEditingName(true)}
                    className={`w-5 h-5 rounded flex items-center justify-center transition-colors flex-shrink-0 ${uiTheme === 'light' ? 'hover:bg-stone-200/30' : 'hover:bg-white/10'}`}
                    aria-label="Name bearbeiten"
                  >
                    <Edit2 className={`w-3 h-3 ${uiTheme === 'light' ? 'text-stone-600' : 'text-stone-400'}`} />
                  </button>
                </div>
              )}
            </div>
          </div>

          <p className={`text-[10px] uppercase tracking-widest px-1 pt-1 ${uiTheme === 'light' ? 'text-stone-600' : 'text-stone-500'}`}>Darstellung</p>

          <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${
            uiTheme === 'light'
              ? 'bg-stone-100/20 border-[#c8ac62]/15'
              : 'bg-white/5 border-[#f0e5a5]/10'
          }`}>
            <Sun className={`w-4 h-4 flex-shrink-0 ${uiTheme === 'light' ? 'text-amber-700/70' : 'text-[#f0e5a5]/70'}`} />
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium leading-snug ${uiTheme === 'light' ? 'text-stone-800' : 'text-stone-100'}`}>Helle Anzeige</p>
              <p className={`text-xs leading-snug ${uiTheme === 'light' ? 'text-stone-600' : 'text-stone-400'}`}>Invertiert dunkle und goldene Akzente in ein helles Interface.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
              <input
                type="checkbox"
                checked={uiTheme === "light"}
                onChange={(e) => {
                  const newTheme = e.target.checked ? "light" : "dark";
                  setUiTheme(newTheme);
                  updateUiThemeMutation.mutate(newTheme);
                }}
                className="sr-only peer"
              />
              <div className="relative w-10 h-[22px] bg-stone-600 rounded-full peer peer-checked:bg-amber-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-[18px] after:w-[18px] after:transition-all peer-checked:after:translate-x-full" />
            </label>
          </div>

          <div className={`px-3 py-2.5 rounded-xl border ${
            uiTheme === 'light'
              ? 'bg-stone-100/20 border-[#c8ac62]/15'
              : 'bg-white/5 border-[#f0e5a5]/10'
          }`}>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <p className={`text-sm font-medium leading-snug ${uiTheme === 'light' ? 'text-stone-800' : 'text-stone-100'}`}>Marker-Skalierung (Karte)</p>
              <span className={`text-xs tabular-nums ${uiTheme === 'light' ? 'text-stone-600' : 'text-stone-400'}`}>
                {safeDiscoveryMarkerScale.toFixed(2)}
              </span>
            </div>
            <p className={`text-xs leading-snug mb-2 ${uiTheme === 'light' ? 'text-stone-600' : 'text-stone-400'}`}>
              Bestimmt die gemeinsame Marker-Groesse in der Kartenansicht.
            </p>
            <input
              type="range"
              min={DISCOVERY_MARKER_SCALE_MIN}
              max={DISCOVERY_MARKER_SCALE_MAX}
              step={0.01}
              value={safeDiscoveryMarkerScale}
              onChange={(event) => onDiscoveryMarkerScaleChange?.(event.target.value)}
              className="w-full accent-amber-500"
            />
          </div>

          <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${
            uiTheme === 'light'
              ? 'bg-stone-100/20 border-[#c8ac62]/15'
              : 'bg-white/5 border-[#f0e5a5]/10'
          }`}>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium leading-snug ${uiTheme === 'light' ? 'text-stone-800' : 'text-stone-100'}`}>Pflanzen-Pulsieren</p>
              <p className={`text-xs leading-snug ${uiTheme === 'light' ? 'text-stone-600' : 'text-stone-400'}`}>Glüheffekt hinter dem FloraLog-Logo. Intensität richtet sich nach dem Pflanzenstatus.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
              <input
                type="checkbox"
                checked={user?.plant_pulse_enabled !== false}
                onChange={(e) => updateUserMutation.mutate({ plant_pulse_enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="relative w-10 h-[22px] bg-stone-600 rounded-full peer peer-checked:bg-amber-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-[18px] after:w-[18px] after:transition-all peer-checked:after:translate-x-full" />
            </label>
          </div>

          <p className={`text-[10px] uppercase tracking-widest px-1 pt-1 ${uiTheme === 'light' ? 'text-stone-600' : 'text-stone-500'}`}>Datenschutz</p>

          <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${
            uiTheme === 'light'
              ? 'bg-stone-100/20 border-[#c8ac62]/15'
              : 'bg-white/5 border-[#f0e5a5]/10'
          }`}>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium leading-snug ${uiTheme === 'light' ? 'text-stone-800' : 'text-stone-100'}`}>Öffentliches Profil</p>
              <p className={`text-xs leading-snug ${uiTheme === 'light' ? 'text-stone-600' : 'text-stone-400'}`}>Wenn aktiv, können Nutzer die dein Profil z.B. über Bestenlisten gefunden haben, deine Kollektionen und Scans sehen. Andernfalls ist dies nur für Freunde möglich.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
              <input
                type="checkbox"
                checked={user?.public_profile !== false}
                onChange={(e) => updateUserMutation.mutate({ public_profile: e.target.checked })}
                className="sr-only peer"
              />
              <div className="relative w-10 h-[22px] bg-stone-600 rounded-full peer peer-checked:bg-green-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-[18px] after:w-[18px] after:transition-all peer-checked:after:translate-x-full" />
            </label>
          </div>

          <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${
            uiTheme === 'light'
              ? 'bg-stone-100/20 border-[#c8ac62]/15'
              : 'bg-white/5 border-[#f0e5a5]/10'
          }`}>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium leading-snug ${uiTheme === 'light' ? 'text-stone-800' : 'text-stone-100'}`}>Globales Forscherlog</p>
              <p className={`text-xs leading-snug ${uiTheme === 'light' ? 'text-stone-600' : 'text-stone-400'}`}>Wenn aktiv, koennen deine Scans im Social-Tab unter Alle Spielern angezeigt werden.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
              <input
                type="checkbox"
                checked={user?.global_explorer_visibility !== false}
                onChange={(e) => updateUserMutation.mutate({ global_explorer_visibility: e.target.checked })}
                className="sr-only peer"
              />
              <div className="relative w-10 h-[22px] bg-stone-600 rounded-full peer peer-checked:bg-green-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-[18px] after:w-[18px] after:transition-all peer-checked:after:translate-x-full" />
            </label>
          </div>

          <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${
            uiTheme === 'light'
              ? 'bg-stone-100/20 border-[#c8ac62]/15'
              : 'bg-white/5 border-[#f0e5a5]/10'
          }`}>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium leading-snug ${uiTheme === 'light' ? 'text-stone-800' : 'text-stone-100'}`}>Lokales Tracking</p>
              <p className={`text-xs leading-snug ${uiTheme === 'light' ? 'text-stone-600' : 'text-stone-400'}`}>Scans im lokalen Tab zeigen (20 km)</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
              <input
                type="checkbox"
                checked={user?.local_tracking !== false}
                onChange={(e) => updateUserMutation.mutate({ local_tracking: e.target.checked })}
                className="sr-only peer"
              />
              <div className="relative w-10 h-[22px] bg-stone-600 rounded-full peer peer-checked:bg-green-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-[18px] after:w-[18px] after:transition-all peer-checked:after:translate-x-full" />
            </label>
          </div>

          <p className={`text-[10px] uppercase tracking-widest px-1 pt-1 ${uiTheme === 'light' ? 'text-stone-600' : 'text-stone-500'}`}>Benachrichtigungen und Standort</p>

          <div className={`rounded-xl border overflow-hidden p-2 ${uiTheme === 'light' ? 'bg-stone-100/20 border-[#c8ac62]/15' : 'bg-white/5 border-[#f0e5a5]/10'}`}>
            <NotificationManager user={user} showInProfile />
          </div>

          <div className={`rounded-xl border overflow-hidden p-2 ${uiTheme === 'light' ? 'bg-stone-100/20 border-[#c8ac62]/15' : 'bg-white/5 border-[#f0e5a5]/10'}`}>
            <LocationManager showInProfile />
          </div>

          <p className={`text-[10px] uppercase tracking-widest px-1 pt-1 ${uiTheme === 'light' ? 'text-stone-600' : 'text-stone-500'}`}>Konto</p>

          <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${
            uiTheme === 'light'
              ? 'bg-stone-100/20 border-[#c8ac62]/15'
              : 'bg-white/5 border-[#f0e5a5]/10'
          }`}>
            <Mail className={`w-4 h-4 flex-shrink-0 ${uiTheme === 'light' ? 'text-stone-600' : 'text-stone-400'}`} />
            <div className="min-w-0 flex-1">
              <p className={`text-[11px] ${uiTheme === 'light' ? 'text-stone-600' : 'text-stone-500'}`}>E-Mail</p>
              {isEditingEmail ? (
                <div className="flex items-center gap-1.5 mt-1">
                  <Input
                    type="email"
                    value={editedEmail}
                    onChange={(e) => setEditedEmail(e.target.value)}
                    className={`h-7 text-sm px-2 ${
                      uiTheme === 'light'
                        ? 'bg-stone-100/50 border-[#c8ac62]/30 text-stone-800 placeholder:text-stone-500'
                        : 'bg-black/30 border-[#f0e5a5]/30 text-stone-100 placeholder:text-stone-400'
                    }`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveEmail();
                      if (e.key === "Escape") {
                        setIsEditingEmail(false);
                        setEditedEmail(user?.email || "");
                        setEmailNotice(null);
                      }
                    }}
                    autoFocus
                  />
                  <button
                    onClick={handleSaveEmail}
                    disabled={updateEmailMutation.isPending}
                    className="w-7 h-7 rounded-lg bg-green-600/70 flex items-center justify-center flex-shrink-0"
                    aria-label="E-Mail speichern"
                  >
                    <CheckCircle className="w-3.5 h-3.5 text-white" />
                  </button>
                  <button
                    onClick={() => {
                      setIsEditingEmail(false);
                      setEditedEmail(user?.email || "");
                      setEmailNotice(null);
                    }}
                    className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0"
                    aria-label="E-Mail-Bearbeitung abbrechen"
                  >
                    <X className="w-3.5 h-3.5 text-stone-300" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 min-w-0 mt-0.5">
                  <p className={`text-sm truncate ${uiTheme === 'light' ? 'text-stone-700' : 'text-stone-200'}`}>
                    {user?.email || "Keine E-Mail hinterlegt"}
                  </p>
                  <button
                    onClick={() => {
                      setEditedEmail(user?.email || "");
                      setEmailNotice(null);
                      setIsEditingEmail(true);
                    }}
                    className={`w-5 h-5 rounded flex items-center justify-center transition-colors flex-shrink-0 ${uiTheme === 'light' ? 'hover:bg-stone-200/30' : 'hover:bg-white/10'}`}
                    aria-label="E-Mail bearbeiten"
                  >
                    <Edit2 className={`w-3 h-3 ${uiTheme === 'light' ? 'text-stone-600' : 'text-stone-400'}`} />
                  </button>
                </div>
              )}
              {emailNotice && (
                <p
                  className={`text-[11px] mt-1 leading-snug ${
                    emailNotice.type === "error"
                      ? 'text-red-400'
                      : (uiTheme === 'light' ? 'text-green-700' : 'text-green-300')
                  }`}
                >
                  {emailNotice.message}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={() => handlePasswordDialogOpenChange(true)}
            className={`w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-sm font-medium transition-colors ${
              uiTheme === 'light'
                ? 'border-[#c8ac62]/35 bg-stone-100/40 text-stone-800 hover:bg-stone-100/60'
                : 'border-[#f0e5a5]/25 bg-white/5 text-stone-100 hover:bg-white/10'
            }`}
          >
            <Lock className="w-4 h-4" />
            Passwort aendern
          </button>

          <button
            onClick={() => navigate(createPageUrl("Donate"))}
            className={`w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-sm font-medium transition-colors ${
              uiTheme === 'light'
                ? 'border-green-400/40 bg-green-100/40 text-green-800 hover:bg-green-100/55'
                : 'border-green-500/30 bg-green-900/20 text-green-300 hover:bg-green-900/35'
            }`}
          >
            <Heart className="w-4 h-4" />
            Spenden
          </button>

          {isAdmin ? (
            <button
              onClick={() => navigate(createPageUrl("ProjectIssueAdmin"))}
              className={`w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-sm font-medium transition-colors ${
                uiTheme === 'light'
                  ? 'border-emerald-400/50 bg-emerald-100/40 text-emerald-900 hover:bg-emerald-100/55'
                  : 'border-emerald-500/35 bg-emerald-900/25 text-emerald-200 hover:bg-emerald-900/40'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              Projekt-Issues (Admin)
            </button>
          ) : null}

          <button
            onClick={() => navigate(createPageUrl("AccountDeletion"))}
            className={`w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-sm font-medium transition-colors mb-1 ${
              uiTheme === 'light'
                ? 'border-red-500/50 bg-red-100/50 text-red-900 hover:bg-red-100/70'
                : 'border-red-400/40 bg-red-900/25 text-red-200 hover:bg-red-900/40'
            }`}
          >
            <Trash2 className="w-4 h-4" />
            Konto dauerhaft loeschen
          </button>

          <button
            onClick={() => logout()}
            className={`w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-sm font-medium transition-colors mb-1 ${
              uiTheme === 'light'
                ? 'border-red-300/40 bg-red-100/40 text-red-800 hover:bg-red-100/55'
                : 'border-red-400/30 bg-red-900/20 text-red-200 hover:bg-red-900/35'
            }`}
          >
            <LogOut className="w-4 h-4" />
            Abmelden
          </button>
          <button
            onClick={() => setImpressumOpen(true)}
            className={`w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-sm font-medium transition-colors mb-1 ${
              uiTheme === 'light'
                ? 'border-blue-400/40 bg-blue-100/40 text-blue-800 hover:bg-blue-100/55'
                : 'border-blue-500/30 bg-blue-900/20 text-blue-300 hover:bg-blue-900/35'
            }`}
          >
            <FileText className="w-4 h-4" />
            Impressum
          </button>
          <Dialog open={impressumOpen} onOpenChange={setImpressumOpen}>
            <DialogContent className={`max-w-3xl max-h-[80vh] overflow-y-auto border ${
              uiTheme === 'light'
                ? 'bg-white text-stone-800 border-[#c8ac62]/40'
                : 'bg-[#121b16] border-[#f0e5a5]/35 text-stone-100'
            }`}>
              <DialogHeader>
                <DialogTitle className={uiTheme === 'light' ? 'text-stone-800' : 'text-stone-100'}>Impressum</DialogTitle>
              </DialogHeader>

              <Card className="border-2 border-stone-200 shadow-lg bg-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-6 h-6 text-green-600" />
                    Angaben gemäß § 5 TMG
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h3 className="font-bold text-lg text-stone-900 mb-2">Betreiber</h3>
                    <p className="text-stone-700">
                      Floralog Collective<br />
                      Dorotheenstr. 41<br />
                      24939 Flensburg<br />
                      <br />
                      Eigentümer: Jascha Kruse
                    </p>
                  </div>

                  <div>
                    <h3 className="font-bold text-lg text-stone-900 mb-2 flex items-center gap-2">
                      <Mail className="w-5 h-5 text-green-600" />
                      Kontakt
                    </h3>
                    <p className="text-stone-700">
                      E-Mail: <br />
                      info@floralog.de<br />
                    </p>
                  </div>

                  <div>
                    <h3 className="font-bold text-lg text-stone-900 mb-2">Verantwortlich i.S.d. § 18 Abs. 2 MStV</h3>
                    <p className="text-stone-700">
                      Floralog Collective<br />
                      Dorotheenstr. 41<br />
                      24939 Flensburg<br />
                      <br />
                      Vertreten durch: Jascha Kruse
                    </p>
                  </div>

                  <div className="pt-4 border-t border-stone-200">
                    <h3 className="font-bold text-lg text-stone-900 mb-2">Haftungsausschluss</h3>
                    <p className="text-sm text-stone-600 leading-relaxed">
                      Die Inhalte dieser App wurden mit größter Sorgfalt erstellt. 
                      Für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte können wir jedoch keine Gewähr übernehmen. 
                      Floralog dient ausschließlich zu Bildungszwecken und ersetzt keine professionelle botanische Beratung.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-bold text-lg text-stone-900 mb-2">Datenschutz</h3>
                    
                    <div className="space-y-4 text-sm text-stone-600 leading-relaxed">
                      <p>
                        Der Schutz Ihrer persönlichen Daten ist uns wichtig. 
                        Ausführliche Informationen zur Verarbeitung Ihrer Daten finden Sie in unserer 
                        <button
                          onClick={() => window.location.href = '/Datenschutz'}
                          className="text-blue-600 hover:underline font-semibold ml-1"
                        >
                          Datenschutzerklärung
                        </button>.
                      </p>

                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <p className="font-semibold text-stone-800 mb-2">In Kürze:</p>
                        <ul className="list-disc list-inside space-y-1">
                          <li>Gespeicherte Daten: E-Mail-Adresse, Anzeigename, Scans und Standortdaten (optional)</li>
                          <li>Backend: Supabase (Auftragsverarbeiter, Server in Frankfurt/EU)</li>
                          <li>Frontend: Cloudflare (CDN zur Inhaltsauslieferung)</li>
                          <li>Pflanzenerkennung: Pl@ntNet und ChatGPT von OpenAI</li>
                          <li>Keine dateneigene Speicherung auf unseren Servern</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <p className="text-right text-sm text-stone-600 mt-4">© Floralog Collective, {new Date().getFullYear()}</p>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
