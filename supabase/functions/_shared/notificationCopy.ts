/**
 * Mirror of STORY_COPY.notifications from src/lib/story/storyDefinition.js.
 * Keep both files in sync when changing notification copy.
 *
 * Placeholders use {varName} syntax.
 */

type SimpleNotification = { title: string; message: string; description?: string };
type TemplateNotification = { title: string; messageTemplate: string; description?: string };
type NotificationDef = SimpleNotification | TemplateNotification;

const NOTIFICATION_COPY: Record<string, NotificationDef> = {
  quizAvailable: {
    title: "🌱 Dein Florabot könnte Hilfe bei der Datenpflege brauchen!",
    message: "Meine Datenbank hat eine Lücke gefunden. Kannst du sie schließen?",
  },
  rewardUnlocked: {
    title: "🌱 Belohnung freigeschaltet!",
    messageTemplate: 'Ausgezeichnete Arbeit! Du hast "{rewardName}" freigeschaltet!',
  },
  friendRequestReceived: {
    title: "💌 Incoming Friend Request: Ein neuer Forscher!",
    messageTemplate: "Hey! {senderName} möchte gemeinsam mit uns die Erde erkunden!",
  },
  friendshipAccepted: {
    title: "🤝 Netzwerk erweitert!",
    messageTemplate:
      "Sehr cool, {accepterName} ist jetzt ein Freund von uns - Gemeinsam entdecken wir mehr!",
  },
  scanLiked: {
    title: "👍 Dein {plantNameOptional} wird gemocht!",
    messageTemplate:
      "{likerName} mag deinen {plantNameOptional} Fund! Mega, ich freu mich, wenn jemand unsere Arbeit schätzt!",
  },
  collectionFollowed: {
    title: "🫆 Neuer Follower für deine Kollektion!",
    messageTemplate:
      "Sehr gut, {followerName} folgt jetzt einer Kollektion von dir. Du hast einen positiven Einfluss auf die Gemeinschaft!",
  },
  firstQuestCompleted: {
    title: "🪐 Die erste Mission abgeschlossen!",
    message:
      "Deine erste Quest ist in meinen Logs. Ein kleiner Schritt für die Menscheit, aber ein großer Schritt für uns!",
    description: "Tippe auf dein Profilbild auf der Startseite und wähle einen Hintergrund aus.",
  },
};

function interpolateBrace(text: string, variables: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (match, key) => {
    return key in variables ? variables[key] : match;
  });
}

export function buildNotificationPayload(
  key: string,
  variables: Record<string, string> = {},
): { title: string; message: string; description: string } {
  const template = NOTIFICATION_COPY[key];
  if (!template) return { title: "", message: "", description: "" };
  const title = interpolateBrace(template.title, variables);
  const rawMessage =
    "messageTemplate" in template ? template.messageTemplate : template.message ?? "";
  return {
    title,
    message: interpolateBrace(rawMessage, variables),
    description: template.description ?? "",
  };
}
