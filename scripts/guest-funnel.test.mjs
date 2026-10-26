import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readGuestFunnel, updateGuestFunnel, needsGuestAccount, subscribeGuestFunnel, hasGuestStorageWarning, GUEST_FUNNEL_KEY } from "../src/lib/guestFunnelStorage.js";
import { createFallbackBotName, createRandomBotName, normalizeBotName } from "../src/lib/botNames.js";
import { persistGuestLogoCustomizationDraft, readGuestLogoCustomizationDraft } from "../src/lib/guestLogoCustomizationStorage.js";

let storage;
beforeEach(() => {
  storage = new Map();
  const events = new EventTarget();
  globalThis.window = {
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
    dispatchEvent: events.dispatchEvent.bind(events),
  };
  updateGuestFunnel({ phase: "intro", token: null, introSeen: false, scanHintDismissed: false });
});

test("first visit, customization, scan and reward preserve the required ordering", () => {
  assert.equal(readGuestFunnel().phase, "intro");
  updateGuestFunnel({ phase: "customization" });
  updateGuestFunnel({ phase: "home_ready", introSeen: true });
  assert.equal(needsGuestAccount(readGuestFunnel()), false);
  updateGuestFunnel({ phase: "scan_pending", token: "a".repeat(64) });
  assert.equal(needsGuestAccount(readGuestFunnel()), false);
  updateGuestFunnel({ phase: "reward_pending" });
  assert.equal(needsGuestAccount(readGuestFunnel()), true);
  updateGuestFunnel({ phase: "account_required" });
  assert.equal(readGuestFunnel().introSeen, true);
  assert.equal(readGuestFunnel().token, "a".repeat(64));
  updateGuestFunnel({ phase: "claimed", token: null });
  assert.equal(needsGuestAccount(readGuestFunnel()), true);
});

test("reload restores cosmetic flow and receipt reference, never points", () => {
  storage.set(GUEST_FUNNEL_KEY, JSON.stringify({ version: 1, phase: "reward_pending", token: "b".repeat(64), introSeen: true, points: 999999 }));
  assert.deepEqual(readGuestFunnel(), { version: 1, phase: "reward_pending", token: "b".repeat(64), introSeen: true, scanHintDismissed: false });
});

test("scan hint dismissal persists without changing scan eligibility", () => {
  updateGuestFunnel({ phase: "home_ready", introSeen: true, scanHintDismissed: true });
  assert.equal(JSON.parse(storage.get(GUEST_FUNNEL_KEY)).scanHintDismissed, true);
  assert.equal(readGuestFunnel().scanHintDismissed, true);
  assert.equal(needsGuestAccount(readGuestFunnel()), false);
  updateGuestFunnel({ phase: "scan_pending" });
  assert.equal(readGuestFunnel().scanHintDismissed, true);
});

test("random Florabot names are valid and rerolls change the name", () => {
  let previous = "";
  const names = new Set();
  for (let i = 0; i < 100; i += 1) {
    const name = createRandomBotName(previous);
    assert.match(name, /^[A-Z][a-z]{5,7}$/);
    assert.notEqual(name, previous);
    assert.equal(normalizeBotName(name), name);
    names.add(name);
    previous = name;
  }
  assert.ok(names.size > 10);
  assert.equal(createFallbackBotName("account-123"), createFallbackBotName("account-123"));
});

test("guest Florabot name survives draft reload and legacy drafts remain valid", () => {
  const draft = { selected_face_asset: "face_bug", selected_border_asset: "border_hacked", selected_border_color: null, bot_name: "Mossi" };
  persistGuestLogoCustomizationDraft(draft);
  assert.deepEqual(readGuestLogoCustomizationDraft(), draft);
  persistGuestLogoCustomizationDraft({ ...draft, bot_name: undefined });
  assert.equal(readGuestLogoCustomizationDraft().bot_name, null);
  persistGuestLogoCustomizationDraft({ ...draft, bot_name: "  Mössi123 " });
  assert.equal(readGuestLogoCustomizationDraft().bot_name, "Mössi");
});

test("invalid phases and versions cannot enter the funnel", () => {
  storage.set(GUEST_FUNNEL_KEY, JSON.stringify({ version: 2, phase: "unlimited", token: "malicious" }));
  assert.equal(readGuestFunnel().phase, "intro");
});

test("same-tab changes notify and unsubscribe cleanly", () => {
  let notifications = 0;
  const unsubscribe = subscribeGuestFunnel(() => notifications++);
  updateGuestFunnel({ phase: "home_ready" });
  assert.equal(notifications, 1);
  unsubscribe();
  updateGuestFunnel({ phase: "scan_pending" });
  assert.equal(notifications, 1);
});

test("storage failure keeps progress in memory and exposes a warning", () => {
  window.localStorage.getItem = () => { throw new Error("storage disabled"); };
  window.localStorage.setItem = () => { throw new Error("storage disabled"); };
  updateGuestFunnel({ phase: "account_required", token: "c".repeat(64) });
  assert.equal(readGuestFunnel().phase, "account_required");
  assert.equal(readGuestFunnel().token, "c".repeat(64));
  assert.equal(hasGuestStorageWarning(), true);
});
