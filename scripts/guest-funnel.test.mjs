import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readGuestFunnel, updateGuestFunnel, needsGuestAccount, subscribeGuestFunnel, hasGuestStorageWarning, GUEST_FUNNEL_KEY } from "../src/lib/guestFunnelStorage.js";

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
  updateGuestFunnel({ phase: "intro", token: null, introSeen: false });
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
  assert.deepEqual(readGuestFunnel(), { version: 1, phase: "reward_pending", token: "b".repeat(64), introSeen: true });
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
