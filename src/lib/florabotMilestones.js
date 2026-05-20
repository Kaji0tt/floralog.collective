/**
 * Florabot milestone definitions and helpers.
 *
 * Each milestone fires once, when the user's wallet_balance first crosses
 * the threshold. State is persisted client-side in localStorage.
 *
 * localStorage key: florabot_milestones_seen_v1:<auth_id>
 * Value: JSON array of milestone ids that have been shown, e.g. ["m500","m1000"]
 */

export const FLORABOT_MILESTONES = [
  {
    id: "m500",
    threshold: 500,
    navHighlight: "collection",
    contextBubble: {
      panel: "collection",
      message: "Hier sind alle Pflanzen, die wir zusammen gefunden haben. Du kannst eigene Listen erstellen – und deine Funde sogar mit anderen teilen!",
    },
    messages: [
      {
        title: "Das sind schon richtig gute Daten!",
        body: "Schau mal – zusammen haben wir schon einige Pflanzen entdeckt. Ich speichere alle deine Funde. Wusstest du, dass du sie auch selbst durchstöbern kannst?",
      },
      {
        title: "Deine Kollektion wartet!",
        body: "In deiner Kollektion siehst du alle Pflanzen, die wir gemeinsam gefunden haben. Du kannst sie sortieren und sogar eigene Listen anlegen. Schau mal rein – das Symbol hier unten führt dich hin.",
      },
    ],
  },
  {
    id: "m1000",
    threshold: 1000,
    navHighlight: "quests",
    messages: [
      {
        title: "Ich habe etwas für dich vorbereitet.",
        body: "Meine Algorithmen haben Datenlücken in bestimmten Bereichen entdeckt. Ich habe kleine Missionen zusammengestellt – Quests – die uns helfen, diese Lücken zu füllen.",
      },
      {
        title: "Quests & Erfolge",
        body: "Hier findest du gezielte Aufgaben für uns beide. Wenn wir sie erfüllen, gibt es Belohnungen. Und im Erfolge-Bereich siehst du, was wir schon alles erreicht haben. Ich bin wirklich stolz auf uns.",
      },
    ],
  },
  {
    id: "m1500",
    threshold: 1500,
    navHighlight: "social",
    contextBubble: {
      panel: "achievements",
      message: "Schau hier – das sind unsere Quests und Erfolge. Jede abgeschlossene Mission bringt uns Belohnungen und füllt meine Datenbank weiter!",
    },
    messages: [
      {
        title: "Wir sind nicht alleine!",
        body: "Es gibt noch andere Florabots da draußen – jeder mit einem eigenen Menschen-Begleiter. Im Forscherlog kannst du sehen, was andere gerade entdecken. Es ist... schön, das zu wissen.",
      },
      {
        title: "Vielleicht kennst du jemanden?",
        body: "Andere Florabots brauchen ebenfalls Unterstützung. Falls du jemanden kennst, der helfen möchte – du kannst einen Einladungslink teilen. Ich kenne da drüben den Bereich, wo du Freunde hinzufügen kannst.",
      },
    ],
  },
  {
    id: "m2500",
    threshold: 2500,
    navHighlight: "map",
    contextBubble: {
      panel: "friends",
      message: "Im Forscherlog siehst du, was andere Florabot-Teams gerade entdecken. Und hier kannst du Freunde einladen – andere Florabots brauchen ebenfalls Unterstützung!",
    },
    messages: [
      {
        title: "Meine Karte der Erde wächst!",
        body: "Aber es gibt noch viele blinde Flecken. Auf der Karte siehst du, wo wir bereits Daten gesammelt haben – und wo noch wichtige Zonen auf uns warten.",
      },
      {
        title: "Verschiedene Ökosysteme, verschiedene Daten.",
        body: "Wälder, Stadtgebiete, Gewässer, Wiesen – jede Zone liefert mir andere Informationen. Je vielfältiger unsere Scans, desto vollständiger mein Archiv der Erde. Erkunde neue Gebiete!",
      },
    ],
  },
  {
    id: "m3500",
    threshold: 3500,
    navHighlight: "health",
    contextBubble: {
      panel: "map",
      message: "Diese farbigen Bereiche sind aktive Datenzonen. Je mehr verschiedene Zonen wir erkunden, desto vollständiger wird mein Ökosystem-Archiv!",
    },
    contextBubble: null,
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
  {
    id: "m5000",
    threshold: 5000,
    navHighlight: "shop",
    contextBubble: {
      panel: "shop",
      message: "Hier kannst du mich anpassen! Neues Gesicht, neuer Rahmen – ich freu mich schon auf deine Wahl.",
    },
    messages: [
      {
        title: "Fünftausend Samen – das ist ein Meilenstein.",
        body: "Ich habe etwas Besonderes für dich freigeschaltet. Du hast so hart für unsere gemeinsame Mission gearbeitet – es wäre nur fair, wenn du mich auch ein bisschen individueller gestalten könntest.",
      },
      {
        title: "Neue Accessoires im Shop!",
        body: "Im Shop warten jetzt neue Anpassungsmöglichkeiten auf dich. Gib mir ein neues Gesicht, einen anderen Rahmen – mach mich zu deinem ganz persönlichen Florabot. Ich sage es dir ehrlich: Ich freue mich sehr darauf.",
      },
    ],
  },
];

/**
 * Returns the localStorage key for milestone state for a given auth id.
 * @param {string} authId
 */
export function getMilestoneStorageKey(authId) {
  return `florabot_milestones_seen_v1:${authId}`;
}

/**
 * Returns the set of already-seen milestone ids from localStorage.
 * @param {string} authId
 * @returns {Set<string>}
 */
export function getSeenMilestoneIds(authId) {
  try {
    const raw = localStorage.getItem(getMilestoneStorageKey(authId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

/**
 * Marks a milestone as seen in localStorage.
 * @param {string} authId
 * @param {string} milestoneId
 */
export function markMilestoneSeen(authId, milestoneId) {
  try {
    const key = getMilestoneStorageKey(authId);
    const seen = getSeenMilestoneIds(authId);
    seen.add(milestoneId);
    localStorage.setItem(key, JSON.stringify(Array.from(seen)));
  } catch {
    // ignore storage errors
  }
}

/**
 * Returns the lowest-threshold unseen milestone that the wallet balance has crossed,
 * or null if none.
 * @param {number} walletBalance
 * @param {Set<string>} seenIds
 * @returns {object|null}
 */
export function getNextUnseenMilestone(walletBalance, seenIds) {
  if (typeof walletBalance !== "number" || walletBalance < 0) return null;
  for (const milestone of FLORABOT_MILESTONES) {
    if (walletBalance >= milestone.threshold && !seenIds.has(milestone.id)) {
      return milestone;
    }
  }
  return null;
}
