import { createContext, useContext, useEffect, useState } from "react";

// Context für OTA GuestFlow Enforcement
export const OtaGuestFlowContext = createContext({ forceGuest: false });

export function OtaGuestFlowProvider({ children }) {
  const [forceGuest, setForceGuest] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function checkOta() {
      try {
        const res = await fetch('/bundle-version.json', { cache: 'no-store' });
        const local = await res.json();
        const localVersion = local?.version;
        const otaUrl = import.meta.env.VITE_OTA_VERSION_URL;
        if (!otaUrl) return;
        const otaRes = await fetch(otaUrl, { cache: 'no-store' });
        const ota = await otaRes.json();
        const otaVersion = ota?.version;
        const mandatory = ota?.mandatory === true;
        if ((otaVersion && localVersion && compareVersions(otaVersion, localVersion) > 0) || mandatory) {
          if (!cancelled) setForceGuest(true);
        }
      } catch (e) {
        // Im Fehlerfall kein Block
      }
    }
    checkOta();
    return () => { cancelled = true; };
  }, []);

  return (
    <OtaGuestFlowContext.Provider value={{ forceGuest }}>
      {children}
    </OtaGuestFlowContext.Provider>
  );
}

// Semver-Vergleich (gibt 1, 0, -1 zurück)
function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

export function useOtaGuestFlow() {
  return useContext(OtaGuestFlowContext);
}
