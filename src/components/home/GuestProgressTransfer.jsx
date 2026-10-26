import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { claimGuestScan } from "@/api/guestScanService";
import { updateCurrentUserProfile } from "@/api/userApi";
import { ensureUserStoryRow, updateUserStory } from "@/api/storyService";
import { readGuestFunnel, updateGuestFunnel } from "@/lib/guestFunnelStorage";
import { checkAndUnlockAchievements } from "@/components/achievements/achievementChecker";
import { updateQuestProgress } from "@/components/utils/questProgress";
import { readGuestLogoCustomizationDraft, clearGuestLogoCustomizationDraft } from "@/lib/guestLogoCustomizationStorage";
import { LOGO_ACCESSORY_DEFAULTS } from "@/lib/logoAccessoryAssets";
import { normalizeBotName } from "@/lib/botNames";
import HomeShellLoader from "@/components/navigation/HomeShellLoader";

export default function GuestProgressTransfer({ children }) {
  const { user, profile, updateProfile } = useAuth();
  const queryClient = useQueryClient();
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const transfer = async () => {
      try {
        const state = readGuestFunnel();
        const claimed = state.token ? await claimGuestScan() : null;
        if (claimed) {
          await checkAndUnlockAchievements({ ...user, ...profile, id: user.id });
          await updateQuestProgress({ ...user, ...profile, id: user.id });
        }
        if (state.introSeen) {
          const story = await ensureUserStoryRow({ authId: user.id, storyVersion: "v1" });
          if (!story?.intro_seen) await updateUserStory(user.id, { intro_seen: true, intro_seen_at: new Date().toISOString() });
        }
        if (claimed) updateGuestFunnel({ phase: "claimed", token: null });
        const draft = readGuestLogoCustomizationDraft();
        if (draft) {
          const isDefault = (profile?.selected_face_asset || LOGO_ACCESSORY_DEFAULTS.selected_face_asset) === LOGO_ACCESSORY_DEFAULTS.selected_face_asset
            && (profile?.selected_border_asset || LOGO_ACCESSORY_DEFAULTS.selected_border_asset) === LOGO_ACCESSORY_DEFAULTS.selected_border_asset
            && !profile?.selected_border_color;
          const updates = {
            ...(isDefault ? {
              selected_face_asset: draft.selected_face_asset,
              selected_border_asset: draft.selected_border_asset,
              selected_border_color: draft.selected_border_color,
            } : {}),
            ...(!normalizeBotName(profile?.bot_name) && draft.bot_name ? { bot_name: draft.bot_name } : {}),
          };
          if (Object.keys(updates).length) {
            const updated = await updateCurrentUserProfile(updates);
            if (!updated) throw new Error("Dein Florabot konnte noch nicht uebernommen werden.");
            updateProfile({ ...profile, ...updated });
            window.dispatchEvent(new CustomEvent("userUpdated", { detail: { ...user, ...profile, ...updated } }));
          }
          clearGuestLogoCustomizationDraft();
        }
        await queryClient.invalidateQueries();
        if (!cancelled) setDone(true);
      } catch (cause) {
        console.error("[GuestProgressTransfer] Transfer failed:", cause);
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Dein Fund konnte noch nicht gesichert werden.");
      }
    };
    transfer();
    return () => { cancelled = true; };
    // Profile updates are an output of this operation, not another trigger.
  }, [user.id, retry]);

  if (error && !done) return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-stone-950 p-6 text-stone-100">
      <h1 className="text-xl font-semibold">Dein Fund wartet noch auf dich</h1>
      <p role="alert" className="max-w-md text-center text-sm">{error}</p>
      <button className="rounded-xl bg-emerald-600 px-5 py-3" onClick={() => { setError(""); setRetry((value) => value + 1); }}>Uebernahme erneut versuchen</button>
      {error.includes("abgelaufen") && <button className="text-sm underline" onClick={() => {
        updateGuestFunnel({ token: null, phase: "claimed" });
        setError("");
        setRetry((value) => value + 1);
      }}>Abgelaufenen Gast-Fund verwerfen</button>}
      <button className="text-sm text-stone-400" onClick={() => setDone(true)}>Spaeter versuchen - zur App</button>
    </div>
  );
  if (!done) return <HomeShellLoader />;
  return children;
}
