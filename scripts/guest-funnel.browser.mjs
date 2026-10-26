import assert from "node:assert/strict";
const { chromium } = await import(process.argv[2] || "playwright");
const baseUrl = "http://127.0.0.1:5173";

const browser = await chromium.launch({
  headless: true, channel: "msedge",
  args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  permissions: ["camera", "geolocation"],
  geolocation: { latitude: 52.5, longitude: 13.4 },
});
await context.addInitScript(() => {
  navigator.mediaDevices.getUserMedia = async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    canvas.getContext("2d").fillRect(0, 0, canvas.width, canvas.height);
    return canvas.captureStream(1);
  };
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => { if (message.text().includes("Error accessing camera")) console.error(message.text()); });
page.on("dialog", (dialog) => { console.log("DIALOG:", dialog.message()); dialog.dismiss(); });
const image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
const reward = { eventSource: "new_scan", baseReward: 30, healthStateBonus: 0, zoneMultiplier: 1, rarityMultiplier: 1, noveltyMultiplier: 1, careMultiplier: 1, firstScanOfDayMultiplier: 2, preStreakReward: 60, finalReward: 60 };
const feedback = { type: "newDiscovery", plantName: "Testpflanze", isInActiveZone: false, rewardDetails: reward };
let status = "open";
let identifications = 0;
let confirmations = 0;
let eventsUnavailable = false;
const requests = [];
await context.route("**/bundle-version.json", (route) => route.fulfill({ json: { version: "test" } }));
await context.route("**/version.json", (route) => route.fulfill({ json: { version: "test", mandatory: false } }));
await context.route(/https:\/\/[^/]+\.supabase\.co\/.*/, async (route) => {
  const request = route.request();
  requests.push(`${request.method()} ${new URL(request.url()).pathname}`);
  if (request.url().includes("/functions/v1/guestScan")) {
    const body = request.postDataJSON();
    let result;
    if (body.action === "events") {
      if (eventsUnavailable) return route.fulfill({ status: 503, json: { error: "Test: Aktionen nicht erreichbar" } });
      result = { events: [{ id: "event", kind: "community", title: "Test-Event", description: "Gemeinsam entdecken" }], weeklyQuests: [{ id: "weekly", title: "Pflanze der Woche", target_species_name: "Löwenzahn", quest_number: 1 }], monthlyQuests: [{ id: "monthly", title: "Oktober entdecken", quest_number: 1 }] };
    }
    else if (body.action === "start") result = { token: "a".repeat(64), status };
    else if (body.action === "upload") result = { path: "test/photo.jpg", uploadToken: "test-token" };
    else if (body.action === "identify") {
      identifications++;
      if (identifications === 1) return route.fulfill({ status: 503, json: { error: "Test: Bestimmung fehlgeschlagen" } });
      status = "identified";
      result = { status, revision: 1, imageUrls: [image], results: [{ id: "plant-test", species_name: "Testpflanze", scientific_name: "Testus floralogus", description: "Eine Testpflanze", genus_name: "Test", category: "Blumen", rarity: "Häufig", inDatabase: true, confidence_percentage: 95 }] };
    } else if (body.action === "confirm") {
      assert.equal(body.revision, 1);
      confirmations++;
      status = "confirmed";
      result = { status, feedback };
    } else if (body.action === "status") result = { status, feedback: status === "confirmed" ? feedback : null, results: [], imageUrls: [] };
    else throw new Error(`Unexpected action ${body.action}`);
    return route.fulfill({ json: result });
  }
  if (request.url().includes("/storage/v1/object/upload/sign/")) return route.fulfill({ json: { Key: "guest-scans/test/photo.jpg" } });
  if (request.url().includes("/auth/v1/")) return route.fulfill({ status: 401, json: { error: "No session" } });
  if (request.url().includes("/rest/v1/")) return route.fulfill({ json: [] });
  return route.fulfill({ status: 404, json: { error: "Unexpected test request" } });
});
try {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  const storyOverlay = page.locator('[data-ui="florabot-story-overlay"]');
  const contextBubble = page.locator('[data-ui="florabot-context-bubble"]');
  await storyOverlay.getByText("Willkommen bei Floralog!", { exact: true }).waitFor();
  await storyOverlay.getByText(/mehr über euer Ökosystem/).waitFor();
  const firstName = await page.evaluate(() => JSON.parse(localStorage.getItem("floralog:guestLogoCustomization")).bot_name);
  assert.match(firstName, /^[A-Z][a-z]+$/);
  await storyOverlay.getByText(new RegExp(`Ich bin ${firstName}, dein Florabot`)).waitFor();
  await page.reload({ waitUntil: "networkidle" });
  await storyOverlay.getByText(new RegExp(`Ich bin ${firstName}, dein Florabot`)).waitFor();
  await page.locator('[data-ui="home-main-content-shell"]').waitFor();
  assert.equal(await page.getByRole("dialog").count(), 0);
  await page.getByRole("button", { name: "Deinen Florabot gestalten" }).click();
  await page.getByRole("heading", { name: "Dein eigener Naturbegleiter" }).waitFor();
  await page.getByRole("button", { name: "Florabot-Namen neu würfeln" }).click();
  const rerolledName = await page.evaluate(() => JSON.parse(localStorage.getItem("floralog:guestLogoCustomization")).bot_name);
  assert.notEqual(rerolledName, firstName);
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Dein eigener Naturbegleiter" }).waitFor();
  await storyOverlay.getByText(rerolledName, { exact: true }).waitFor();
  await page.locator('button[aria-pressed]').nth(1).click();
  await page.getByRole("button", { name: "Weiter", exact: true }).click();
  await storyOverlay.waitFor({ state: "hidden" });
  await contextBubble.getByText(/Pflanze in deiner Nähe/).waitFor();
  await contextBubble.getByRole("button", { name: "Schließen", exact: true }).click();
  await contextBubble.waitFor({ state: "hidden" });
  await page.getByRole("heading", { name: "Neuling", exact: true }).waitFor();
  await page.getByText(`und ${rerolledName}`, { exact: true }).waitFor();
  await page.getByText("Test-Event", { exact: true }).waitFor();
  assert.equal(await page.locator('[data-ui="home-bottom-nav"] button:disabled').count(), 4);
  assert.equal(await page.getByRole("button", { name: "Pflanzengesundheit", exact: true }).count(), 0);
  assert.equal(await page.getByRole("button", { name: "Anpassen", exact: true }).count(), 0);
  assert.equal(await page.getByRole("button", { name: "Erste Pflanze scannen", exact: true }).count(), 0, "No separate guest CTA");
  assert.equal(await page.locator('[data-ui="home-plant-hero-section"] [data-logo-click-target]').count(), 1, "Uses the existing Home Florabot hero");
  const background = await page.locator('[data-ui="home-main-content-shell"]').evaluate((element) => getComputedStyle(element.parentElement.parentElement.firstElementChild).backgroundImage);
  assert.match(background, /radial-gradient/);
  assert.doesNotMatch(background, /url\(/);
  assert.equal(await page.getByRole("dialog").count(), 0);
  const draft = await page.evaluate(() => localStorage.getItem("floralog:guestLogoCustomization"));
  assert.match(draft, /border_hacked/);
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Neuling", exact: true }).waitFor();
  assert.equal(await contextBubble.count(), 0, "Dismissed scan hint stays dismissed on reload");
  assert.equal(await page.evaluate(() => localStorage.getItem("floralog:guestLogoCustomization")), draft);
  await page.setViewportSize({ width: 320, height: 568 });
  const cameraBounds = await page.getByRole("button", { name: "Scannen", exact: true }).boundingBox();
  assert.ok(cameraBounds && cameraBounds.y >= 0 && cameraBounds.y + cameraBounds.height <= 568, "Camera remains visible on small screens");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Optionen", exact: true }).click();
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await page.getByRole("dialog").waitFor();
  await page.getByRole("button", { name: "Spaeter - Home ansehen" }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Scannen", exact: true }).click();
  await page.waitForURL("**/Scanner");
  const capture = page.getByRole("button", { name: "Foto aufnehmen", exact: true });
  await capture.waitFor();
  await page.waitForFunction(() => document.querySelector("video")?.readyState >= 2);
  await capture.click();
  await page.getByRole("button", { name: "Analyse starten" }).click();
  await page.getByText("Fehler: Test: Bestimmung fehlgeschlagen", { exact: true }).waitFor();
  assert.equal(await page.getByRole("dialog").count(), 0, "Failed scan does not force login");
  await page.getByRole("button", { name: "Nochmal versuchen", exact: true }).click();
  await page.getByRole("heading", { name: "Foto aufnehmen", exact: true }).click();
  await page.waitForFunction(() => document.querySelector("video")?.readyState >= 2);
  await page.getByRole("button", { name: "Foto aufnehmen", exact: true }).click();
  await page.getByRole("button", { name: "Analyse starten" }).click();
  await page.getByRole("button", { name: "Entdeckung bestaetigen", exact: true }).waitFor();
  assert.equal(await page.getByRole("dialog").count(), 0);
  await page.getByRole("button", { name: "Entdeckung bestaetigen", exact: true }).click();
  await page.waitForURL("**/Home");
  await page.getByRole("button", { name: "Okay", exact: true }).waitFor({ state: "visible", timeout: 20000 });
  assert.equal(await page.getByRole("dialog").count(), 0, "No login until feedback completion");
  const secondTab = await context.newPage();
  await secondTab.goto(`${baseUrl}/Home`, { waitUntil: "networkidle" });
  await secondTab.getByRole("status").filter({ hasText: "anderen Tab" }).waitFor();
  assert.equal(await secondTab.getByRole("button", { name: "Okay", exact: true }).count(), 0, "Reward animation is exclusive across tabs");
  await secondTab.close();
  await page.getByRole("button", { name: "Okay", exact: true }).click();
  await page.getByRole("dialog").waitFor();
  await page.getByRole("button", { name: "Mit Google fortfahren" }).waitFor();
  await page.getByLabel("E-Mail", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Spaeter - Home ansehen" }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.equal(await page.getByRole("dialog").count(), 0);
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Neuling", exact: true }).waitFor();
  assert.equal(await page.getByRole("dialog").count(), 0, "Dismissed login stays dismissed on reload");
  await page.getByRole("button", { name: "Scannen", exact: true }).click();
  await page.getByRole("dialog").waitFor();
  assert.equal(identifications, 2);
  assert.equal(confirmations, 1);
  eventsUnavailable = true;
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Aktionen erneut laden", exact: true }).waitFor();
  eventsUnavailable = false;
  await page.getByRole("button", { name: "Aktionen erneut laden", exact: true }).click();
  await page.getByText("Test-Event", { exact: true }).waitFor();
  for (const scenario of [
    { width: 320, height: 568, theme: "dark", phase: "customization" },
    { width: 1280, height: 800, theme: "light", phase: "intro" },
  ]) {
    await page.setViewportSize({ width: scenario.width, height: scenario.height });
    await page.evaluate(({ theme, phase }) => {
      localStorage.setItem("home-ui-theme", theme);
      localStorage.setItem("floralog:guestFunnel:v1", JSON.stringify({ version: 1, phase, token: null, introSeen: false, scanHintDismissed: false }));
    }, scenario);
    await page.reload({ waitUntil: "networkidle" });
    await storyOverlay.waitFor();
    if (scenario.phase === "intro") {
      await page.getByRole("button", { name: "Deinen Florabot gestalten" }).click();
    }
    await page.getByRole("heading", { name: "Dein eigener Naturbegleiter" }).waitFor();
    const continueButton = page.getByRole("button", { name: "Weiter", exact: true });
    await continueButton.scrollIntoViewIfNeeded();
    const continueBounds = await continueButton.boundingBox();
    assert.ok(continueBounds && continueBounds.y >= 0 && continueBounds.y + continueBounds.height <= scenario.height, "Customization action is reachable");
    await continueButton.click();
    await storyOverlay.waitFor({ state: "hidden" });
    await contextBubble.getByRole("button", { name: "Schließen", exact: true }).click();
    await contextBubble.waitFor({ state: "hidden" });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, "No horizontal overflow");
    assert.equal(await page.locator('[data-ui="home-bottom-nav"] button:disabled').count(), 4);
  }
  assert.equal(errors.length, 0, errors.join("\n"));
  assert.equal(requests.filter((request) => request.includes("UserPlantDiscovery") || request.includes("PublicProfile")).length, 0, "No private guest queries");
  console.log("PASS: random named introduction and reroll persistence, Neuling heading and named subtitle, event stripe and failed-load recovery, shared Home layout, overlays with umlauts, dismissible scan bubble, small-screen and light/desktop layouts, avatar persistence, disabled nav, scan retry, reward before auth, one confirmed guest scan, no private guest queries.");
} finally {
  await browser.close();
}
