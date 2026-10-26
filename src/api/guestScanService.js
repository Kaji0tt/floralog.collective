import { supabase } from "@/api/supabaseClient";
import { readGuestFunnel, updateGuestFunnel } from "@/lib/guestFunnelStorage";

export async function callGuestScan(action, payload = {}) {
  const { data, error } = await supabase.functions.invoke("guestScan", {
    body: { action, token: readGuestFunnel().token, ...payload },
  });
  if (error) {
    let message = error.message;
    if (error.context instanceof Response) {
      const body = await error.context.json().catch(() => null);
      message = body?.error || message;
    }
    throw new Error(message || "Der Gast-Scan ist gerade nicht erreichbar.");
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function startGuestScan() {
  const state = readGuestFunnel();
  if (state.token) return callGuestScan("status");
  const data = await callGuestScan("start");
  updateGuestFunnel({ token: data.token, phase: "scan_pending" });
  return data;
}

export async function identifyGuestPlant(items, organs, location) {
  await startGuestScan();
  const paths = [];
  for (const item of items) {
    if (!(item instanceof File)) {
      throw new Error("Bitte nimm die Fotos fuer den Gast-Scan erneut auf.");
    }
    const { path, uploadToken } = await callGuestScan("upload", { contentType: item.type, size: item.size });
    const { error } = await supabase.storage.from("guest-scans").uploadToSignedUrl(path, uploadToken, item, { contentType: item.type });
    if (error) throw new Error(`Das Foto konnte nicht hochgeladen werden: ${error.message}`);
    paths.push(path);
  }
  return callGuestScan("identify", { paths, organs, location });
}

export async function confirmGuestPlant(index, revision) {
  const receipt = await callGuestScan("confirm", { index, revision });
  updateGuestFunnel({ phase: "reward_pending" });
  return receipt;
}

export async function claimGuestScan() {
  const state = readGuestFunnel();
  if (!state.token || state.phase === "claimed") return null;
  const receipt = await callGuestScan("status");
  if (receipt.status !== "confirmed" && receipt.status !== "claimed") return null;
  const result = await callGuestScan("claim");
  return result;
}
