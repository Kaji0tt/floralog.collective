export const GUEST_FUNNEL_KEY = "floralog:guestFunnel:v1";
const CHANGE_EVENT = "guestFunnelChanged";
let memoryState = { version: 1, phase: "intro", token: null, introSeen: false, scanHintDismissed: false };
let storageWarning = false;

const phases = new Set(["intro", "customization", "home_ready", "scan_pending", "reward_pending", "account_required", "claimed"]);

export function readGuestFunnel() {
  try {
    const raw = window.localStorage.getItem(GUEST_FUNNEL_KEY);
    if (raw) {
      const value = JSON.parse(raw);
      if (value?.version === 1 && phases.has(value.phase)) {
        memoryState = {
          version: 1,
          phase: value.phase,
          token: typeof value.token === "string" ? value.token : null,
          introSeen: value.introSeen === true,
          scanHintDismissed: value.scanHintDismissed === true,
        };
      }
    }
  } catch (error) {
    storageWarning = true;
    console.warn("[GuestFunnel] Local storage unavailable:", error);
  }
  return memoryState;
}

export function updateGuestFunnel(patch) {
  memoryState = { ...readGuestFunnel(), ...patch, version: 1 };
  try {
    window.localStorage.setItem(GUEST_FUNNEL_KEY, JSON.stringify(memoryState));
  } catch (error) {
    storageWarning = true;
    console.warn("[GuestFunnel] Could not persist progress:", error);
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
  return memoryState;
}

export const hasGuestStorageWarning = () => storageWarning;
export const needsGuestAccount = (state) => ["reward_pending", "account_required", "claimed"].includes(state.phase);

export function subscribeGuestFunnel(listener) {
  const handleStorage = (event) => {
    if (event.key === GUEST_FUNNEL_KEY) listener();
  };
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener("storage", handleStorage);
  };
}
