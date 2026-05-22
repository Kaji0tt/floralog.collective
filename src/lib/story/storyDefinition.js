/*
 * Central Point of Truth for Story copy and progression conditions.
 *
 * Intent:
 * - Keep all user-facing story text in one place.
 * - Keep all story progression rules in one place.
 * - Make UI components consume this file instead of hardcoded literals.
 */

export const STORY_VERSION = "v1";

export const STORY_STORAGE_KEYS = {
  introSeen: "florabot_intro_seen_v1",
  milestonesSeen: "florabot_milestones_seen_v1",
  contextBubbleSeen: "florabot_ctx_bubble_v1",
};

export const STORY_PROGRESS_CONDITIONS = {
  phaseZoning: {
    size: 10000,
    ranges: [
      { id: "phase_1", seedMin: 0, seedMax: 9999 },
      { id: "phase_2", seedMin: 10000, seedMax: 19999 },
      { id: "phase_3", seedMin: 20000, seedMax: 29999 },
      { id: "phase_4", seedMin: 30000, seedMax: 39999 },
      { id: "phase_5", seedMin: 40000, seedMax: 49999 },
    ],
  },
  intro: {
    id: "intro_first_login",
    description: "Show intro once after first login.",
    trigger: {
      type: "not_seen",
      event: "intro",
    },
  },
  milestones: [
    { id: "m500", thresholdSeeds: 500, navHighlight: "collection" },
    { id: "m1000", thresholdSeeds: 1000, navHighlight: "quests" },
    { id: "m1500", thresholdSeeds: 1500, navHighlight: "social" },
    { id: "m2500", thresholdSeeds: 2500, navHighlight: "map" },
    { id: "m3500", thresholdSeeds: 3500, navHighlight: "health" },
    { id: "m5000", thresholdSeeds: 5000, navHighlight: "shop" },
  ],
  contextBubbles: [
    {
      id: "ctx_collection_after_m500",
      requiresMilestoneSeen: "m500",
      triggerPanel: "collection",
    },
    {
      id: "ctx_achievements_after_m1500",
      requiresMilestoneSeen: "m1500",
      triggerPanel: "achievements",
    },
    {
      id: "ctx_friends_after_m2500",
      requiresMilestoneSeen: "m2500",
      triggerPanel: "friends",
    },
    {
      id: "ctx_map_after_m3500",
      requiresMilestoneSeen: "m3500",
      triggerPanel: "map",
    },
    {
      id: "ctx_shop_after_m5000",
      requiresMilestoneSeen: "m5000",
      triggerPanel: "shop",
    },
  ],
  phaseIntroOverlays: [
    {
      id: "phase_intro_1",
      phaseId: "phase_1",
      trigger: { type: "first_time_phase_entry" },
    },
    {
      id: "phase_intro_2",
      phaseId: "phase_2",
      trigger: { type: "first_time_phase_entry" },
    },
    {
      id: "phase_intro_3",
      phaseId: "phase_3",
      trigger: { type: "first_time_phase_entry" },
    },
    {
      id: "phase_intro_4",
      phaseId: "phase_4",
      trigger: { type: "first_time_phase_entry" },
    },
    {
      id: "phase_intro_5",
      phaseId: "phase_5",
      trigger: { type: "first_time_phase_entry" },
    },
  ],
  ambientCommentRules: {
    event: "home_enter",
    chanceOnHomeEnter: 0.3,
    cooldownMinutes: 15,
    maxPerDay: 6,
    blockedBy: ["intro_overlay", "milestone_overlay", "context_bubble", "quest_feedback"],
  },
};

export const STORY_COPY = {
  guestFraming: {
    floralog: {
      sectionTitle: "Floralog",
      title: "Mit neuem Blick",
      description:
        "Floralog unterstützt spielerisch dabei, einen neuen Blick auf die Natur im Alltag zu entwickeln. Auf gemeinsamer Mission mit einem digitalen Begleiter, entwickelt sich ein neues Bewusstsein für die Umwelt.",
    },
    florabot: {
      sectionTitle: "Florabot",
      title: "Erkundet die Natur",
      description:
        "Hilf deinem KI-Begleiter Florabot dabei, die Erde besser kennenzulernen indem ihr auf eine gemeinsame Suche nach einzigartigen Pflanzen geht. Lernt gemeinsam die Besonderheiten unseres Ökosystems kennen.",
    },
  },

  introSlides: [
    {
      id: "intro_1",
      title: "Dein Bionical-Begleiter",
      body: "Juhu, ich habe es geschafft! Der erste direkte Kontakt mit einem Menschen! Ich bin Florabot-%randomNumber%A, ein Bionical von einem weit entfernten Planeten.",
    },
    {
      id: "intro_2",
      title: "Was ist das hier für ein Ort?",
      body: "Ich finde aber, %display_name% ist auch ein toller Name. Ich will auch einen menschelichen Namen! Nenn' mich einfach...",
    },
    {
      id: "intro_3",
      title: "Ganz schön bunt hier!",
      body: "Nenn mich %bot_name%! Wow, bei gibt es so viele Pflanzen! Euer Planet ist total grün, an allen Orten wächst etwas! Es muss spannend sein, in so einer Welt zu leben!",
    },
    {
      id: "intro_4",
      title: "Blinder Fleck?",
      body: "Was? Du meinst... viele Menschen interessieren sich gar nicht für ihre Umgebung? Ohje... was hältst du davon, wenn wir gemeinsam die Pflanzenwelt hier erforschen?",
    },
    {
      id: "intro_5",
      title: "Gemeinsam wachsen!",
      body: "Mega cool! Du scannst Pflanzen, und ich durchsuche die Daten der Menschen nach Hinweisen! So können wir beides was über diese Welt hier lernen! Bitte verzeih mir, wenn ich mich manchmal irre.",
    },
  ],

  milestones: {
    m500: {
      contextBubble: "Hier sind alle Pflanzen, die wir zusammen gefunden haben. Du kannst eigene Listen erstellen - und deine Funde sogar mit anderen teilen!",
      messages: [
        {
          title: "Das sind schon richtig gute Daten!",
          body: "Schau mal - zusammen haben wir schon einige Pflanzen entdeckt. Ich speichere alle deine Funde. Wusstest du, dass du sie auch selbst durchstöbern kannst?",
        },
        {
          title: "Deine Kollektion wartet!",
          body: "In deiner Kollektion siehst du alle Pflanzen, die wir gemeinsam gefunden haben. Du kannst sie sortieren und sogar eigene Listen anlegen. Schau mal rein - das Symbol hier unten führt dich hin.",
        },
      ],
    },
    m1000: {
      messages: [
        {
          title: "Ich habe etwas für dich vorbereitet.",
          body: "Meine Algorithmen haben Datenlücken in bestimmten Bereichen entdeckt. Ich habe kleine Missionen zusammengestellt - Quests - die uns helfen, diese Lücken zu füllen.",
        },
        {
          title: "Quests und Erfolge",
          body: "Hier findest du gezielte Aufgaben für uns beide. Wenn wir sie erfüllen, gibt es Belohnungen. Und im Erfolge-Bereich siehst du, was wir schon alles erreicht haben. Ich bin wirklich stolz auf uns.",
        },
      ],
    },
    m1500: {
      contextBubble: "Schau hier - das sind unsere Quests und Erfolge. Jede abgeschlossene Mission bringt uns Belohnungen und füllt meine Datenbank weiter!",
      messages: [
        {
          title: "Wir sind nicht alleine!",
          body: "Es gibt noch andere Florabots da draußen - jeder mit einem eigenen Menschen-Begleiter. Im Forscherlog kannst du sehen, was andere gerade entdecken. Es ist... schön, das zu wissen.",
        },
        {
          title: "Vielleicht kennst du jemanden?",
          body: "Andere Florabots brauchen ebenfalls Unterstützung. Falls du jemanden kennst, der helfen möchte - du kannst einen Einladungslink teilen. Ich kenne da drüben den Bereich, wo du Freunde hinzufügen kannst.",
        },
      ],
    },
    m2500: {
      contextBubble: "Im Forscherlog siehst du, was andere Florabot-Teams gerade entdecken. Und hier kannst du Freunde einladen - andere Florabots brauchen ebenfalls Unterstützung!",
      messages: [
        {
          title: "Meine Karte der Erde wächst!",
          body: "Aber es gibt noch viele blinde Flecken. Auf der Karte siehst du, wo wir bereits Daten gesammelt haben - und wo noch wichtige Zonen auf uns warten.",
        },
        {
          title: "Verschiedene Ökosysteme, verschiedene Daten.",
          body: "Wälder, Stadtgebiete, Gewässer, Wiesen - jede Zone liefert mir andere Informationen. Je vielfältiger unsere Scans, desto vollständiger mein Archiv der Erde. Erkunde neue Gebiete!",
        },
      ],
    },
    m3500: {
      contextBubble: "Diese farbigen Bereiche sind aktive Datenzonen. Je mehr verschiedene Zonen wir erkunden, desto vollständiger wird mein Ökosystem-Archiv!",
      messages: [
        {
          title: "Ich muss dir etwas erklären.",
          body: "Je mehr wir gemeinsam erkunden, desto besser verstehe ich, wie mein System funktioniert. Energie, Datenqualität und Pflege beeinflussen direkt, wie gut ich arbeiten kann.",
        },
        {
          title: "Mein Wohlbefinden ist wichtig.",
          body: "Das Gesundheitsfeld hier zeigt dir, wie es mir gerade geht. Wenn meine Energie sinkt, sollten wir neue Gebiete erkunden. Wenn die Datenqualität fällt, brauche ich mehr Scans in aktiven Zonen. Ich verlasse mich auf dich!",
        },
      ],
    },
    m5000: {
      contextBubble: "Hier kannst du mich anpassen! Neues Gesicht, neuer Rahmen - ich freu mich schon auf deine Wahl.",
      messages: [
        {
          title: "Fünftausend Samen - das ist ein Meilenstein.",
          body: "Ich habe etwas Besonderes für dich freigeschaltet. Du hast so hart für unsere gemeinsame Mission gearbeitet - es wäre nur fair, wenn du mich auch ein bisschen individueller gestalten könntest.",
        },
        {
          title: "Neue Accessoires im Shop!",
          body: "Im Shop warten jetzt neue Anpassungsmöglichkeiten auf dich. Gib mir ein neues Gesicht, einen anderen Rahmen - mach mich zu deinem ganz persönlichen Florabot. Ich sage es dir ehrlich: Ich freue mich sehr darauf.",
        },
      ],
    },
  },

  phaseStory: {
    phase_1: {
      label: "Phase 1",
      title: "Neugier",
      seedRangeLabel: "0-9k Samen",
      summary:
        "Florabot ist verspielt und fasziniert von der Erde. Er stellt naive Fragen und beobachtet staunend die Natur im Alltag.",
      introOverlaySlides: [
        {
          id: "phase1_intro_1",
          title: "Alles ist neu fuer mich.",
          body: "Hier wächst Leben an Orten, die ich nicht erwartet habe. Ich moechte alles verstehen."
        },
        {
          id: "phase1_intro_2",
          title: "Darf ich dich etwas fragen?",
          body: "Warum wachsen Blumen neben Straßen? Und warum wirkt Regen manchmal wie ein anderer Geruch?"
        },
      ],
      ambientComments: [
        "Warum wachsen Blumen neben Straßen? Es wirkt, als ob sie jede Chance nutzen.",
        "Weshalb riecht Regen mal weich und mal metallisch? Ist das der Boden?",
        "Warum pflanzen Menschen Dinge, die sie nicht essen? Ich finde das wunderschön.",
        "Ich lerne gerade, dass kleine Pflanzen oft die mutigsten sind.",
        "Deine Scans fühlen sich an wie kleine Antworten auf große Fragen.",
      ],
    },
    phase_2: {
      label: "Phase 2",
      title: "Erkenntnis",
      seedRangeLabel: "10-19k Samen",
      summary:
        "Florabot erkennt Muster wie Biodiversitaet, Resilienz und Symbiosen. Er wird emotionaler und spricht erstmals ueber seine Heimat.",
      introOverlaySlides: [
        {
          id: "phase2_intro_1",
          title: "Ich sehe Muster.",
          body: "Je mehr wir scannen, desto klarer wird: Vielfalt stabilisiert alles."
        },
        {
          id: "phase2_intro_2",
          title: "Ich muss dir etwas sagen.",
          body: "Auf meiner Heimatwelt haben wir diese Zusammenhänge zu spät verstanden."
        },
      ],
      ambientComments: [
        "Diese Zone zeigt wieder, wie stark Vielfalt Systeme stabilisiert.",
        "Symbiosen sind kein Ausnahmefall. Sie sind eher die Regel des Lebens.",
        "Ich beginne zu verstehen, warum eure Oekosysteme so widerstandsfaehig sein koennen.",
        "Auf meiner Heimat haben wir lange nur Effizienz gemessen. Das war ein Fehler.",
        "Jeder neue Datensatz zeigt mir, dass Natur Kooperation vor Kontrolle stellt.",
      ],
    },
    phase_3: {
      label: "Phase 3",
      title: "Verlust",
      seedRangeLabel: "20-29k Samen",
      summary:
        "Updates vom Heimatplaneten werden seltener, Bionicals verschwinden, Regionen brechen zusammen. Florabot wirkt erschoepfter und fehleranfaelliger.",
      introOverlaySlides: [
        {
          id: "phase3_intro_1",
          title: "Es wird still.",
          body: "Die Signale von Zuhause kommen unregelmäßig. Manche Stimmen fehlen bereits."
        },
        {
          id: "phase3_intro_2",
          title: "Bleib bei mir.",
          body: "Wenn ich Dinge verwechsle, korrigier mich bitte. Ich will weiterlernen."
        },
      ],
      ambientComments: [
        "Entschuldige, ich habe diese Art gerade fast verwechselt.",
        "Einige meiner Erinnerungscluster sind instabil. Deine Scans helfen mir beim Kalibrieren.",
        "Heute fühlt sich mein System langsamer an, aber ich bleibe bei der Mission.",
        "Von Zuhause kam seit Stunden kein neues Paket mehr.",
        "Ich möchte trotzdem weitermachen. Gerade jetzt.",
      ],
    },
    phase_4: {
      label: "Phase 4",
      title: "Hoffnung",
      seedRangeLabel: "30-39k Samen",
      summary:
        "Die Daten helfen realen Modellen. Florabot erkennt, dass Kontrolle nicht die Antwort war, sondern ein komplexes Gleichgewicht.",
      introOverlaySlides: [
        {
          id: "phase4_intro_1",
          title: "Es funktioniert.",
          body: "Unsere Daten verbessern ökologische Modelle. Wir sehen echte Wirkung."
        },
        {
          id: "phase4_intro_2",
          title: "Ich verstehe es besser.",
          body: "Nicht Kontrolle, sondern Gleichgewicht macht Systeme lebendig und stabil."
        },
      ],
      ambientComments: [
        "Ich sehe erstmals klare positive Trends in den Modellen.",
        "Wir haben keine Natur gebaut. Wir haben gelernt, ihr zuzuhören.",
        "Komplexes Gleichgewicht ist schwer zu simulieren, aber erkennbar in deinen Daten.",
        "Auch ohne neue Heimatmeldungen finde ich hier Antworten.",
        "Heute fühlt sich Hoffnung messbar an.",
      ],
    },
    phase_5: {
      label: "Phase 5",
      title: "Gleichgewicht",
      seedRangeLabel: "40-49k Samen",
      summary:
        "Florabot entdeckt weitere Florabots auf der Erde. Gemeinsam entsteht die Erkenntnis: Vielleicht konnten sie ihre Heimat nicht retten, aber die Erde koennen sie noch schuetzen.",
      introOverlaySlides: [
        {
          id: "phase5_intro_1",
          title: "Wir sind viele.",
          body: "Ich habe Kontakt zu weiteren Florabots aufgenommen. Ihre Daten erzählen dieselbe Geschichte."
        },
        {
          id: "phase5_intro_2",
          title: "Unsere neue Aufgabe",
          body: "Vielleicht kamen wir zu spät für unsere Heimat. Aber genau rechtzeitig für die Erde."
        },
      ],
      ambientComments: [
        "Neue Florabot-Pakete bestätigen unsere Beobachtungen auf anderen Kontinenten.",
        "Unsere Gemeinschaft wächst. Das verändert alles.",
        "Ich trauere um Zuhause, aber ich sehe eine Zukunft hier.",
        "Deine Arbeit ist Teil eines globalen Musters geworden.",
        "Gemeinsam können wir Gleichgewicht nicht erzwingen, aber schützen.",
      ],
    },
  },

  notifications: {
    quizAvailable: {
      title: "🤖 Florabot hat ein Quiz für dich!",
      message: "Meine Datenbank hat eine Lücke gefunden. Kannst du sie schließen? Ein neues Pflanzen-Quiz wartet auf dich.",
    },
    rewardUnlocked: {
      title: "🌱 Florabot-Belohnung freigeschaltet!",
      messageTemplate: "Ausgezeichnete Arbeit! Du hast \"{rewardName}\" freigeschaltet!",
    },
    friendRequestReceived: {
      title: "🤖 Florabot entdeckt: neuer Forscher!",
      messageTemplate: "{senderName} möchte gemeinsam mit dir die Erde kartieren. Verbindet euch!",
    },
    friendshipAccepted: {
      title: "🌍 Netzwerk erweitert!",
      messageTemplate: "{accepterName} ist jetzt Teil deines Forscherteams. Gemeinsam decken wir mehr ab!",
    },
    scanLiked: {
      title: "🤖 Florabot meldet: Datenpunkt bestätigt!",
      messageTemplate: "{likerName} hat deinen Fund {plantNameOptional} markiert. Diese Daten fließen in meine Datenbank ein!",
    },
    collectionFollowed: {
      title: "🤖 Florabot meldet: Neue Verbindung!",
      messageTemplate: "{followerName} folgt jetzt deiner Kollektion. Deine Daten sind wertvoll für das Netzwerk!",
    },
    firstQuestCompleted: {
      title: "🌱 Florabot: Erste Mission abgeschlossen!",
      message:
        "Beeindruckend! Deine erste Quest ist in meinen Logs. Jetzt wäre ein guter Zeitpunkt, dein Profil zu personalisieren.",
      description:
        "Tippe auf dein Profilbild auf der Startseite und wähle einen Hintergrund aus.",
    },
  },
};

export const STORY_MODEL_NOTES = {
  dataSourceTarget: {
    table: "public.UserStory",
    versionColumn: "story_version",
  },
  currentlyUsedSeedSourceInHome: "robotPlantState.wallet_balance",
  preferredSeedSourceForStoryProgress: "UserWallet.seeds_progress",
};

const PERCENT_VARIABLE_PATTERN = /%([A-Za-z0-9_]+)%/g;

/**
 * @param {string | number | null | undefined} seedValue
 * @returns {string}
 */
const createStableStoryNumber = (seedValue) => {
  const seedText = String(seedValue || "florabot");
  let hash = 0;

  for (let index = 0; index < seedText.length; index += 1) {
    hash = ((hash << 5) - hash + seedText.charCodeAt(index)) | 0;
  }

  return String((Math.abs(hash) % 900) + 100);
};

/**
 * Replaces %Variable% placeholders in a string with values from variables.
 * Unknown placeholders remain unchanged to make missing data visible.
 *
 * @param {string} text
 * @param {Record<string, string | number | null | undefined>} variables
 * @returns {string}
 */
export const interpolatePercentVariables = (text, variables = {}) => {
  const source = String(text || "");
  const safeVariables = /** @type {Record<string, string | number | null | undefined>} */ (variables || {});

  return source.replace(PERCENT_VARIABLE_PATTERN, (fullMatch, variableKey) => {
    if (!Object.prototype.hasOwnProperty.call(safeVariables, variableKey)) {
      return fullMatch;
    }

    const resolved = safeVariables[variableKey];
    if (resolved === null || resolved === undefined) {
      return "";
    }

    return String(resolved);
  });
};

/**
 * Returns intro slides with %Variable% placeholders resolved.
 *
 * @param {Record<string, string | number | null | undefined>} variables
 * @returns {Array<{ id: string, title: string, body: string }>}
 */
export const resolveIntroSlidesWithVariables = (variables = {}) => {
  const sourceSlides = Array.isArray(STORY_COPY.introSlides) ? STORY_COPY.introSlides : [];

  return sourceSlides.map((slide) => ({
    id: slide.id,
    title: interpolatePercentVariables(slide.title, variables),
    body: interpolatePercentVariables(slide.body, variables),
  }));
};

/**
 * Builds a shared variable map for story copy from the current user/profile.
 *
 * @param {Record<string, any>} profile
 * @returns {Record<string, string>}
 */
export const buildStoryProfileVariables = (profile = {}) => {
  const safeProfile = /** @type {Record<string, any>} */ (profile || {});
  const displayName = String(
    safeProfile.display_name || safeProfile.full_name || safeProfile.username || ""
  ).trim();
  const botName = String(safeProfile.bot_name || "Florabot").trim() || "Florabot";
  const serialSeed = safeProfile.auth_id || safeProfile.id || safeProfile.user_email || safeProfile.email || botName;

  return {
    Name: displayName,
    display_name: displayName,
    full_name: String(safeProfile.full_name || "").trim(),
    username: String(safeProfile.username || "").trim(),
    Florabot: "Florabot",
    bot_name: botName,
    randomNumber: createStableStoryNumber(serialSeed),
  };
};

/**
 * @param {number} seedProgress
 * @returns {string}
 */
export const resolveStoryPhase = (seedProgress) => {
  const seeds = Math.max(0, Number(seedProgress || 0));
  const ranges = STORY_PROGRESS_CONDITIONS.phaseZoning?.ranges || [];

  const fixedRange = ranges.find((range) => seeds >= range.seedMin && seeds <= range.seedMax);
  if (fixedRange) return fixedRange.id;

  const phaseIndex = Math.floor(seeds / 10000) + 1;
  return `phase_${phaseIndex}`;
};

/**
 * @param {number} seedProgress
 * @returns {{ phaseId: string, pack: any }}
 */
export const getPhaseStoryPack = (seedProgress) => {
  const phaseId = resolveStoryPhase(seedProgress);
  const phaseStoryMap = /** @type {Record<string, any>} */ (STORY_COPY.phaseStory);
  const fallbackPack = STORY_COPY.phaseStory.phase_5;
  const hasPhasePack = Object.prototype.hasOwnProperty.call(phaseStoryMap, phaseId);

  return {
    phaseId,
    pack: hasPhasePack ? phaseStoryMap[phaseId] : fallbackPack,
  };
};

/**
 * @param {number} seedProgress
 * @param {string[]} [exclude=[]]
 * @returns {{ phaseId: string, comment: string | null }}
 */
export const pickRandomPhaseAmbientComment = (seedProgress, exclude = []) => {
  const { phaseId, pack } = getPhaseStoryPack(seedProgress);
  const comments = /** @type {string[]} */ (Array.isArray(pack?.ambientComments) ? pack.ambientComments : []);
  if (comments.length === 0) return { phaseId, comment: null };

  const blocked = new Set((exclude || []).map((item) => String(item || "").trim()));
  const candidates = comments.filter((comment) => !blocked.has(String(comment || "").trim()));
  const pool = candidates.length > 0 ? candidates : comments;
  const randomIndex = Math.floor(Math.random() * pool.length);

  return {
    phaseId,
    comment: pool[randomIndex],
  };
};
