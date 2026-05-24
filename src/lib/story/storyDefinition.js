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
    { id: "m1500", thresholdSeeds: 1500, navHighlight: "quests" },
    { id: "m2500", thresholdSeeds: 2500, navHighlight: "social" },
    { id: "m3500", thresholdSeeds: 3500, navHighlight: "map" },
    { id: "m4500", thresholdSeeds: 4500, navHighlight: "health" },
    { id: "m6000", thresholdSeeds: 6000, navHighlight: "shop" },
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
      id: "ctx_shop_after_m6000",
      requiresMilestoneSeen: "m6000",
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
      title: "Ein neuer Freund auf der Erde!", /* Begrüßungstext*/
      body: "Hallo  %display_name%! Ich bin Florabot-i%randomNumber%Xa-v1.13 - aber nenn' mich einfach %bot_name%!",
    },
    {
      id: "intro_2",
      title: "Ganz schön bunt hier!", /* Mission */
      body: "Ich habe den Weltraum nach einem grünen Planeten durchsucht. Dabei habe ich eure Erde entdeckt! Es sieht hier total lebendig aus - ihr Menschen müsst es hier lieben!",
    },
    {
      id: "intro_3",
      title: "Die Menschen sehen die Natur nicht?", /* Naivität */
      body: "Was? Du meinst... die meisten Menschen nehmen die Natur gar nicht richtig wahr? Ohje... das ist in meiner Heimat leider ähnlich gewesen. Deshalb wurden wir Florabots entwickelt: Um von intakten Ökosystemen zu lernen.",
    },
    {
      id: "intro_4",
      title: "Gemeinsam wachsen!", /* Hoffnung */
      body: "Das schaffe ich jedoch nicht alleine. Ich brauche deine Hilfe, um die Pflanzen hier besser zu verstehen. Mit jedem Scan sammel ich Datenpunkte, die dabei helfen meine Heimat zu retten!",
    },
    {
      id: "intro_5",
      title: "Irrtum ist Teil des Lernens.", /* Fehlerfreundlichkeit */
      body: "Ich gebe mir zwar Mühe, deine Scans richtig einzuordnen, aber mir passieren Fehler! Wir Roboter sind schon ziemlich clever, aber wir können uns irren!",
    },
    {
      id: "intro_6",
      title: "Eine Reise startet.", /* Aufbruch */
      body: "Also dann: Finde deine erste heimische Pflanze und scanne sie! Lass uns starten!",
    },
  ],

  milestones: {
    m500: {
      contextBubble: "Die Kollektion zeigt, was alle Florabots auf der Erde bisher entdeckt haben und Pflanzen, die du bereits gefunden hast, sind hier eingetragen!",
      messages: [
        {
          title: "Die ersten Scans",
          body: "Das sind ein paar spannende erste Funde die du gemacht hast! Ich habe Sie in der Kollektion ganz links in der Navigation für unser Archiv einsortiert!",
        },
        {
          title: "Deine Kollektion wächst!",
          body: "Man kann über die Listenfunktion auch eigene, thematische Kollektionen anlegen. Damit kannst du helfen, dein Wissen über die Pflanzenwelt zu teilen.",
        },
      ],
    },
    m1500: {
      messages: [
        {
          title: "Ein ewiger Kreislauf",
          body: "Sehr gut %display_name%! Die Daten der anderen Florabots und unsere eigenen ergeben zusammen ein klares Bild. Die Pflanzen haben sich den Zeitstrukturen auf der Erde angepasst.",
        },
        {
          title: "Wiederkehrende Aufgaben",
          body: "Ich habe dazu ein paar Missionen vorbereitet, um dieses Verhalten zu beobachten. Ich bin gespannt, wie sich die Pflanzen daran angepasst haben!",
        },
        {
          title: "Es ist schön, nicht alleine zu sein.",
          body: "Außerdem haben die anderen Florabots und ich versucht, unsere Daten für euch Menschen aufzubereiten. Dort könnt ihr sehen, was wir als Gemeinschaft schon alles geschafft haben! Schau mal in den Bereich mit den Quests und Erfolgen - dort findest du alles!",
        },
      ],
    },
    m2500: {
      contextBubble: "Die Florabots des Floralogs",
      messages: [
        {
          title: "Wir sind nicht alleine!",
          body: "Es ist total verrückt, wie viele Florabots inzwischen auf der Erde unterwegs sind! Was die anderen so entdeckt haben, kannst du im Forscherlog sehen, das sich ganz rechts in der Navigation befindet.",
        },
        {
          title: "Vielleicht kennst du jemanden?",
          body: "Mit der Hilfe der Menschen, können wir vielleicht schon bald ein intaktes Ökosystem wiederherstellen. Falls du jemanden kennst, der uns unterstützen möchte, kannst du ihm den Link unter dem Plus-Zeichen einladen!",
        },
      ],
    },
    m3500: {
      contextBubble: "Eine Karte der Erde entsteht!",
      messages: [
        {
          title: "Meine Karte der Erde wächst!",
          body: "Auf dem Kartensymbol siehst du, wo wir bereits Daten gesammelt haben - und wo noch wichtige Zonen auf uns warten. Du kannst dort auch sehen, was andere Florabots im 2,5km Umkreis entdeckt haben.",
        },
        {
          title: "Verschiedene Ökosysteme, verschiedene Daten.",
          body: "Uns ist aufgefallen, das unterschiedliche Pflanzen in unterschiedlichen Zonen wachsen. Wälder, Stadtgebiete, Gewässer, Wiesen - jede Zone liefert andere Informationen. Für Scans in diesen Zonen bekommen wir mehr Datenpunkte!",
        },
        {
          title: "Verschiedene Ökosysteme, verschiedene Daten.",
          body: "Es ist wichtig, Daten von allen Geozonen zu sammeln. Nur so können wir das Ökosystem der Erde vollständig verstehen!",
        },
      ],
    },
    m4500: {
      contextBubble: "Mein Gesundheitsstatus - Energie, Datenqualität und Pflege meines Systems beeinflussen Größe und Anzahl der Geozonen, die ich ermitteln kann.",
      messages: [
        {
          title: "Wie ich die Geozonen ermittele.",
          body: "Ich brauche deine Hilfe, um die Geozonen zu ermitteln. Wenn du schläfst, sammel ich neue Daten aus dem Umfeld und generiere für den neuen Tag neue Geozonen.",
        },
        {
          title: "Mein Wohlbefinden ist wichtig.",
          body: "Mein Gesundheitsfeld zeigt dir, wie es mir gerade geht. Im ruhenden Zustand kannst du mich leicht aktivieren und ich erhalte alle Boni mit dreifacher Wirkung! Der Effekt lässt nach, je fitter ich bin - aber es ist schwer, mich in einem lebendigen, oder gar kräftigen Zustand zu halten! ",
        },
        {
          title: "Mein Wohlbefinden ist wichtig: Energie",
          body: "Wenn meine Energie sinkt, sollten wir wandern gehen. Je größer die Distanz zwischen den einzelnen Scans ist, desto mehr Energie habe ich! Und desto mehr Geozonen kann ich ermitteln!",
        },
        {
          title: "Mein Wohlbefinden ist wichtig: Datenqualität",
          body: "Wenn meine Datenqualität sinkt, brauche ich mehr Scans in aktiven Zonen. Je höher die Datenqualität ist, desto größer sind die Geozonen, die ich ermitteln kann!",
        },
        {
          title: "Mein Wohlbefinden ist wichtig: Pflege",
          body: "Wenn meine Pflege sinkt, brauche ich mehr Aufmerksamkeit. Bei einer guten Systempflege, können meine Schaltkreise zusätzliche Zonen ermitteln!",
        },
      ],
    },
    m6000: {
      contextBubble: "Hier kannst du mich anpassen! Neues Gesicht, neuer Rahmen - ich freu mich schon auf deine Wahl.",
      messages: [
        {
          title: "Du bist mein bester Freund!",
          body: "Ich habe etwas Besonderes für dich freigeschaltet. Du hast so hart für unsere gemeinsame Mission gearbeitet und hast auf diesem Weg bestimmt schon viele Samen gesammelt. Jetzt kannst du dir davon ein neues Aussehen für mich freischalten!",
        },
        {
          title: "Neue Accessoires im Shop!",
          body: "Außerdem gibt es im Shop Anpassungen, die du freischalten kannst wenn du bestimmte Pflanzen in den entsprechenden Geozonen scannst. Ich bin so gespannt, was du wohl auswählen wirst!",
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
       /* {
          id: "phase1_intro_1",
          title: "Alles ist neu fuer mich.",
          body: "Hier wächst Leben an Orten, die ich nicht erwartet habe. Ich moechte alles verstehen."
        },
        {
          id: "phase1_intro_2",
          title: "Darf ich dich etwas fragen?",
          body: "Warum wachsen Blumen neben Straßen? Und warum wirkt Regen manchmal wie ein anderer Geruch?"
        },
        */
      ],
      ambientComments: [
        "Warum wachsen Blumen neben Straßen? Es wirkt, als ob sie jede Chance nutzen.",
        "Weshalb riecht Regen unterschiedlich? Liegt das am Boden?",
        "Dieser komische Löwenzahn wächst wirklich überall! Scheinbar darf man sich was wünschen, wenn man all ihre Samen pustet.",
        "Warum pflanzen Menschen Dinge, die sie nicht essen? Das ist wunderschön.",
        "Wusstest du, dass Pflanzen miteinander sprechen? Sie tun das über ihre Wurzeln und die Luft!",
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
