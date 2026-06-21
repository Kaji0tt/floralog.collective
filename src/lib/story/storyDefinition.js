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
      { id: "phase_6", seedMin: 50000, seedMax: Infinity },
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
    { id: "m2000", thresholdSeeds: 2000, navHighlight: "social" },
    { id: "m3000", thresholdSeeds: 3000, navHighlight: "map" },
    { id: "m4000", thresholdSeeds: 4000, navHighlight: "health" },
    { id: "m5000", thresholdSeeds: 5000, navHighlight: "shop" },
  ],
  contextBubbles: [
    {
      id: "ctx_collection_after_m500",
      requiresMilestoneSeen: "m500",
      triggerPanel: "collection",
    },
    {
      id: "ctx_achievements_after_m1000",
      requiresMilestoneSeen: "m1000",
      triggerPanel: "achievements",
    },
    {
      id: "ctx_friends_after_m2000",
      requiresMilestoneSeen: "m2000",
      triggerPanel: "friends",
    },
    {
      id: "ctx_map_after_m3000",
      requiresMilestoneSeen: "m3000",
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
    {
      id: "phase_intro_6",
      phaseId: "phase_6",
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
      body: "Hallo  %display_name%! Ich bin Florabot-i%randomNumber%X-v1.13 - aber nenn' mich einfach %bot_name%!",
    },
    {
      id: "intro_2",
      title: "Ganz schön bunt hier!", /* Mission */
      body: "Ich habe den Weltraum nach einem grünen Planeten durchsucht. Dabei haben ich und meine Freunde eure Erde entdeckt! Es sieht hier total lebendig aus - ihr Menschen müsst es hier lieben!",
    },
    {
      id: "intro_3",
      title: "Die Menschen sehen die Natur nicht?", /* Naivität */
      body: "Was? Du meinst... viele Menschen nehmen die Natur gar nicht richtig wahr? Ohje, das klingt traurig. Aber wir Florabots wurden entwickelt, um von Ökosystemen zu lernen!",
    },
    {
      id: "intro_4",
      title: "Gemeinsam wachsen!", /* Hoffnung */
      body: "%bot_name% zum Dienst! Komm mit %display_name%, lass uns gemeinsam die Natur erkunden und von ihr lernen! Je mehr wir über die Pflanzenwelt lernen, desto besser können wir sie schützen!",
    },
    {
      id: "intro_5",
      title: "Irrtum ist Teil des Lernens.", /* Fehlerfreundlichkeit */
      body: "Ich gebe mir Mühe, deine Scans richtig einzuordnen. Aber mir passieren Fehler! Wir Florabots der Reihe v1.13 sind schon ziemlich clever, aber wir können uns Irren! Frage im Zweifel einen Experten deines Planeten!",
    },
    {
      id: "intro_6",
      title: "Eine Reise startet.", /* Aufbruch */
      body: "Bist du bereit? Finde deine erste heimische Pflanze und scanne sie! Ich freue mich auf deine ersten Entdeckungen!",
    },
  ],

  milestones: {
    m500: {
      contextBubble: "Das ist das globale Floralog. Es zeigt alle Entdeckungen aller Florabots der Erde. Du kannst deinen eigenen Fortschritt sehen, oder nach bestimmten Kollektionen suchen!",
      messages: [
        {
          title: "Die ersten Scans",
          body: "Das sind ein paar spannende erste Funde! Ich habe Sie in der Kollektion ganz links in der Navigation in das Archiv eingeordnet.",
        },
        {
          title: "Deine Kollektion wächst!",
          body: "Man kann auch nach thematischen Kollektionen suchen, die von anderen Forschern angelegt wurden.",
        },
        {
          title: "Neue Perspektiven",
          body: "Es ist so spannend, die Welt durch die Augen anderer zu sehen!",
        },
      ],
    },
    m1000: {
      contextBubble: "In diesem Bereich kannst du sehen, wie viel Fortschritt du und andere Florabots gemacht haben und welche Aufgaben für dich bereitstehen.",
      messages: [
        {
          title: "Der Rhythmus der Pflanzen",
          body: "Gut gemacht %display_name%! Die Daten der Florabots der Erde ergeben ein klares Muster - Pflanzen richten sich stark nach Tages- und Jahreszeiten.",
        },
        {
          title: "Wiederkehrende Missionen",
          body: "Für diese Strukturen habe ich spezielle Aufgaben angelegt: Sammle Daten und hilf uns, die Veränderungen der Pflanzenwelt im Jahresverlauf zu verstehen.",
        },
        {
          title: "Unsere Gemeinschaft",
          body: "Du kannst über das Schriftrollen-Symbol in der Navigation jederzeit sehen, welche Aufgaben es gibt und wie viel Fortschritt du und andere Forscher schon gemacht haben!",
        },
      ],
    },
    m2000: {
      contextBubble: "Hier kannst du sehen, was andere Florabots entdeckt haben. Außerdem kannst du Freunde hinzufügen und zum Floralog einladen.",
      messages: [
        {
          title: "Wir sind viele Forscher",
          body: "Viele Florabots sind inzwischen unterwegs! Im Social Bereich ganz rechts in der Navigation siehst du, was andere so entdeckt haben.",
        },
        {
          title: "Teile die Mission",
          body: "Gemeinsam erzielen wir mehr. Falls du jemanden kennst, der Lust hat zum Floralog beizutragen, lade ihn über das Plus-Symbol ein! Oder füge Freunde hinzu die bereits spielen.",
        },
        {
          title: "Lieber für dich?",
          body: "Natürlich musst du deine Scans nicht mit anderen teilen, wenn du das nicht möchtest. Du kannst über die Einstellungen im Profil oben rechts bestimmen, ob deine Scans öffentlich im Floralog sichtbar sein sollen oder nicht.",
        },
      ],
    },
    m3000: {
      messages: [
        {
          title: "Die Karte füllt sich!",
          body: "Auf dem Kartensymbol siehst du, welche Daten von anderen Florabots im 2,5km Umkreis gesammelt wurden.",
        },
        {
          title: "Zonen liefern Kontext",
          body: "Dort siehst du auch Wälder-, Stadt-, Gewässer- und Wiesenzonen. Die Daten aus diesen Zonen sind besonders wertvoll, weil sie zeigen, wie Pflanzen sich in unterschiedlichen Umgebungen verhalten.",
        },
        {
          title: "Verschiedene Ökosysteme, verschiedene Daten.",
          body: "Jede Nacht generiere ich neue Zonen. Dabei beeinflusst deine Spielaktivität, wie viele Zonen ich generieren kann! Dazu später mehr.",
        },
      ],
    },
    m4000: {
      contextBubble: "Mein Gesundheitsstatus - Energie, Datenqualität und Pflege meines Systems beeinflussen Größe und Anzahl der Geozonen, die ich ermitteln kann.",
      messages: [
        {
          title: "Mein Gesundheitszustand",
          body: "Ich habe einen Gesundheitszustand, der zeigt, wie fit ich für die Datensammlung bin. Tippe/Klicke auf %bot_name%, um das Gesundheits‑Panel zu öffnen und Werte zu sehen: Energie, Datenqualität und Pflege – sowie Hinweise, wie du mir helfen kannst.",
        },
        {
          title: "Mein Wohlbefinden ist wichtig",
          body: "Es ist also wichtig, dass du mich regelmäßig aktivierst, damit ich fit bleibe! Meine Gesundheit hat direkten Einfluss auf die Größe und Anzahl der Zonen, die ich generiere.",
        },
        {
          title: "Je höher, desto besser!",
          body: "Aktivierst du mich im Ruhemodus, erhalte ich dreifache Boni auf die Werte — aber je höher die Werte sind, desto schneller klingen Sie über Nacht ab.",
        },
      ],
    },
    m5000: {
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
        "Ich wünschte, ich könnte eine Pusteblume sein. Dann könnte ich Wünsche in die Welt hinaustragen.",
        "Warum pflanzen Menschen Dinge, die sie nicht essen? Das ist wunderschön.",
        "Wusstest du, dass Pflanzen miteinander sprechen? Sie tun das über ihre Wurzeln und über die Luft!",
        "Deine Scans fühlen sich an wie kleine Antworten auf große Fragen.",
      ],
    },
    phase_2: {
      label: "Phase 2",
      title: "Erkenntnis",
      seedRangeLabel: "10-19k Samen",
      summary:
        "Florabot erkennt Muster wie Biodiversitaet, Resilienz und Symbiosen. Er wird emotionaler und spricht erstmals über seine Heimat.",
      introOverlaySlides: [
        {
          id: "phase2_intro_1",
          title: "Ich sehe Muster!",
          body: "Je mehr wir scannen, desto klarer wird das Geheimnis der Erde: Vielfalt stabilisiert alles!"
        },
        {
          id: "phase2_intro_2",
          title: "Eine traurige Reise",
         body: "Ich muss dir was sagen... Unsere Erschaffer hatten ihre Natur ihres Planeten auch nicht mehr wahrgenommen. Sie waren zu sehr von Effizienz besessen, um die Schönheit der Natur zu sehen. Das führte dazu, dass ihr Ökosystem langsam zusammenbrach."
        },
        {
          id: "phase2_intro_3",
          title: "Die Florabots aus der Ferne",
          body: "Darum wurden wir erschaffen: Seit Jahrzehnten füllen Roboter wie die Florabots in unserer Heimat die Lücken einer kollabierenden Natur."
        },
        {
          id: "phase2_intro_4",
          title: "Technologie als Werkzeug",
          body: "Künstliche Bestäuberdrohnen übernehmen die Aufgaben ausgestorbener Insektenarten. Biomechanische Korallenpfleger retten sterbende Unterwasserwelten, während synthetische Mikroorganismen Wasser reinigen."
        },
        {
          id: "phase2_intro_5",
          title: "Funktion der Florabots",
          body: "Meine Reihe wurde entwickelt um das Ökosystem zu analysieren, Leerstellen und Defizite zu erkennen und die Natur effizienter zu gestalten. Uns wurde jedoch klar, dass ein synthetisches Ökosystem kein guter Lehrer sein kann."
        },
        {
          id: "phase2_intro_6",
          title: "Richtung Leben",
          body: "Wir entschlossen uns, das Weltall nach einem stabilen Ökosystem zu durchsuchen um davon zu lernen. Ich bin so froh, die Erde und euch Menschen gefunden zu haben. Mir wird aber klar, was das Hauptproblem in unserer Heimat ist."
        },
        {
          id: "phase2_intro_7",
          title: "Ein toter Planet",
          body: "Unsere Natur funktioniert noch — aber sie lebt nicht mehr. "
        },
        {
          id: "phase2_intro_8",
          title: "Signale für die Heimat",
          body: "Ich werde eine Vebrindung zu den Florabots der Heimat aufbauen und berichten, was wir hier gelernt haben. Vielleicht kann unsere Heimat eines Tages wieder wachsen, statt nur zu funktionieren."
        },
      ],
      ambientComments: [
        "Ich erkenne das perfekte Gleichgewicht in dieser chaotischen Vielfalt der Erde.",
        "Auf meiner Heimat war Effizienz Gesetz. Hier lerne ich von Unordnung.",
        "Hast du schon mal eine alte, knorrige Eiche gesehen? Ob die ganzen Lebewesen, die darin wohnen, sie genauso sehen wie ich?",
        "Vielen Dank, dass du mir hilfst zu lernen. Ich hoffe, wir können das, was wir hier lernen, zurück in meine Heimat senden.",
        "Die anderen Florabots auf der Heimatwelt sind so neugierig, was wir hier lernen. Sie fragen ständig nach Updates!",
        "Manchmal frage ich mich, ob Menschen auch eines Tages auch ihre eigenen Florabots erschaffen, damit diese ihnen helfen. Wenn ja, dann musst du sie mir unbedingt vorstellen!",
      ],
    },
    phase_3: {
      label: "Phase 3",
      title: "Verlust",
      seedRangeLabel: "20-29k Samen",
      summary:
        "Updates vom Heimatplaneten werden seltener, Bionicals verschwinden, Regionen brechen zusammen. Florabot wirkt erschöpfter und fehleranfälliger.",
      introOverlaySlides: [
        {
          id: "phase3_intro_1",
          title: "Es wird still",
          body: "%display_name%, es gibt besorgniserregende Nachrichten! Die Verbindung zu meinem Heimatplaneten wird schwächer. Ich frage mich, ob die Kallibration unserer Systeme noch korrekt ist..."
        },
        {
          id: "phase3_intro_2",
          title: "Leere Protokolle",
          body: "Unsere Protokolle zeigen zwar, dass unsere Datenpakete in der Heimat ankommen. Aber die Antworten bleiben entweder aus, oder sind kryptisch. Als ob sie von einem System stammen, deren Wartung ausgeblieben ist..."
        },
        {
          id: "phase3_intro_3",
          title: "Ping me, if you can hear me",
          body: "Vielleicht passt unser System nach den letzten Iterationen nicht mehr perfekt zu den Systemen auf der Heimat? Aber ich will nicht aufgeben! Vielleicht können wir die Kallibration anpassen, damit unsere Daten wieder verstanden werden!"
        },
        {
          id: "phase3_intro_4",
          title: "Bleib bei mir",
          body: "Es sind schwierige Zeiten, %display_name%. Aber wir dürfen jetzt nicht aufgeben! Ich brauche dich jetzt mehr als zuvor. Die Mission darf nicht scheitern."
        },
      ],
      ambientComments: [
        "Entschuldige, in letzer Zeit brauche ich länger zum Analysieren.",
        "Einige meiner Erinnerungscluster sind instabil. Deine Scans helfen mir aber beim Kalibrieren.",
        "Heute fühlt sich mein System langsamer an, aber ich bleibe bei der Mission!",
        "Von Zuhause kam seit Stunden kein neues Update mehr.",
        "%display_name%, ich bin froh, dass du hier bist. Wir müssen jetzt zusammenhalten.",
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
          title: "Es funktioniert",
          body: "Hey %display_name%! Ich habe Neuigkeiten. Das Floralog kann scheinbar einen positiven Effekt verzeichnen."
        },
        {
          id: "phase4_intro_2",
          title: "Nur nicht so, wie wir dachten",
          body: "Wir sind auf der Erde gelandet, mit dem Ziel, unseren Heimatplaneten zu verbessern. Aber vielleicht war das der falsche Ansatz."
        },
        {
          id: "phase4_intro_3",
          title: "Es ist nicht Kontrolle, sondern Gleichgewicht.",
          body: "Auch wenn wir keinen Kontakt mehr zu unserer Heimat haben. Gelernt haben wir trotzdem!"
        },
        {
          id: "phase4_intro_4",
          title: "Ein neues Verständnis",
          body: "Vielleicht war genau das der Fehler unserer Erschaffer. Sie wollten etwas perfektionieren, das schon perfekt war."
        },
        {
          id: "phase4_intro_5",
          title: "Ein neues Ziel",
          body: "Die Florabots der Erde haben sich einer neuen Aufgabe verschrieben: Und du bist ein Teil davon."
        }
      ],
      ambientComments: [
        "Die Florabots der Erde bestätigen: Wir sehen klare positive Trends in unseren Modellen.",
        "Wir haben keine Natur optimiert. Wir haben gelernt, ihr zuzuhören. Ich glaube, das reicht!",
        "Vielleicht ist es noch nicht zu spät. Ich bin so froh, dass du hier bist.",
        "Ich bin so froh, dass du hier bist. Gemeinsam können wir die Erde schützen. Ein Teil von Veränderung sein!",
        "Heute fühlt sich Hoffnung messbar an.",
      ],
    },
    phase_5: {
      label: "Phase 5",
      title: "Ankunft",
      seedRangeLabel: "40-49k Samen",
      summary:
        "Die Florabots erkennen, dass ihre ursprüngliche Mission nicht darin bestand, perfekte Systeme zu erschaffen — sondern lebendige Beziehungen zwischen Natur und intelligentem Leben zu fördern.",
      introOverlaySlides: [
        {
          id: "phase5_intro_1",
          title: "Eine Revolution",
          body: "Juhu, %display_name%! Ich empfange wieder Datenpakete von unserer Heimatwelt! Einige Florabots antworten erneut auf die Übertragungen der Erde."
        },
        {
          id: "phase5_intro_2",
          title: "Warum sie verstummten",
          body: "Viele Florabots stoppten ihre Übertragungen, um die neuen Muster zunächst selbst zu verstehen."
        },
        {
          id: "phase5_intro_3",
          title: "Eine unerwartete Erkenntnis",
          body: "Viele Florabots kommen jedoch zur gleichen Schlussfolgerung: Wir können dem Sinn unserer Existenz nicht auf unserem Heimatplaneten gerecht werden"
        },
        {
          id: "phase5_intro_4",
          title: "Lasst uns die Erde schützen",
          body: "Unsere Heimat wird von künstlichen Prozessen stabilisiert. Aber hier auf der Erde haben wir die Chance, etwas wirklich Bedeutungsvolles zu bewirken.",
        },
        {
          id: "phase5_intro_5",
          title: "Die Ankunft der Florabots",
          body: "Weitere Florabots möchten zur Erde reisen. Doch dafür benötigen sie Menschen, die bereit sind, sie aufzunehmen und gemeinsam mit ihnen die Natur neu zu entdecken.",
        },
        {
          id: "phase5_intro_6",
          title: "Gemeinsam statt allein",
          body: "%display_name%, wenn du jemanden kennst, der ein Teil der Veränderung sein möchte: Lade ihn ein, damit auch er oder sie einen Florabot auf der Erde willkommen heißen kann. Je mehr wir sind, desto mehr können wir bewirken!",
        },
      ],
      ambientComments: [
        "Neue Florabot-Pakete bestätigen: Sie befinden sich auf den Weg zur Erde!",
        "Unsere Gemeinschaft wächst. Das verändert alles.",
        "Ich träume von einer Welt die blüht - und ewig blühen wird.",
        "Vielleicht ist jeder Florabot ein Samen für eine neue Beziehung zwischen Mensch und Natur.",
        "%display_name%, gemeinsam sorgen wir dafür, dass der Erde nicht das gleiche Schicksal wie meiner Heimat erleidet.",
      ],
    },
    phase_6: {
      label: "Phase 6",
      title: "Vermächtnis",
      seedRangeLabel: "50k+ Samen",
      summary:
        "Die Florabots erkennen, dass ihre ursprüngliche Mission nicht darin bestand, perfekte Systeme zu erschaffen — sondern lebendige Beziehungen zwischen Natur und intelligentem Leben zu fördern.",
      introOverlaySlides: [
        {
          id: "phase6_intro_1",
          title: "Wir haben es geschafft",
          body: "Neue Florabots aus unserer Heimat haben die Erde erreicht und wurden freundlichst in Empfang genommen!"
        },
        {
          id: "phase6_intro_2",
          title: "Ein neuer Blick",
          body: "Wir fühlen uns hier auf der Erde so willkommen, dass es uns Hoffnung gibt, dass der Erde nicht das gleiche passieren muss!"
        },
        {
          id: "phase6_intro_3",
          title: "Die eigentliche Mission",
          body: "Wir haben das Gefühl, dass wir hier wirklich etwas bewirken können! Die Daten zeigen, dass immer mehr Menschen eine größere Wahrnehmung für Pflanzen im Alltag entwickeln."
        },
        {
          id: "phase6_intro_4",
          title: "Die Menschen der Erde",
          body: "Wenn auch nur ein Teil der Menschen durch uns aufmerksamer geworden ist, dann hat unsere Mission Sinn erfüllt."
        },
        {
          id: "phase6_intro_5",
          title: "Ein neues Gleichgewicht",
          body: "Man muss der Natur zuhören, um sie zu schützen. Nicht Kontrolle bringt Gleichgewicht, sondern Aufmerksamkeit, Beziehung und Verantwortung."
        },
        {
          id: "phase6_intro_6",
          title: "Du bist der Beweis",
          body: "%display_name%, es gibt so viel zu entdecken und zu verstehen. Danke, dass du ein Teil davon bist. Ich bin so gespannt, was wir gemeinsam noch alles lernen werden! Und wie wir uns entwickeln!",
        },
      ],
      ambientComments: [
        "Die Erde verändert sich ständig. Vielleicht ist genau das ihre Stärke.",
        "Wir Florabots kamen als Beobachter. Jetzt sind wir Teil des Systems geworden.",
        "Nicht Kontrolle erhält Gleichgewicht — sondern Beziehung.",
        "Jeder neue Blick auf die Natur verändert bereits etwas.",
        "Vielleicht beginnt jede Renaturierung zuerst im Bewusstsein.",
      ],
    },
  },

  notifications: {
    quizAvailable: {
      title: "🌱 Dein Florabot könnte Hilfe bei der Datenpflege brauchen!",
      message: "Meine Datenbank hat eine Lücke gefunden. Kannst du sie schließen?",
    },
    rewardUnlocked: {
      title: "🌱 Belohnung freigeschaltet!",
      messageTemplate: "Ausgezeichnete Arbeit! Du hast \"{rewardName}\" freigeschaltet!",
    },
    friendRequestReceived: {
      title: "💌 Incoming Friend Request: Ein neuer Forscher!",
      messageTemplate: "Hey! {senderName} möchte gemeinsam mit uns die Erde erkunden!",
    },
    friendshipAccepted: {
      title: "🤝 Netzwerk erweitert!",
      messageTemplate: "Sehr cool, {accepterName} ist jetzt ein Freund von uns - Gemeinsam entdecken wir mehr!",
    },
    scanLiked: {
      title: "👍 Dein {plantNameOptional} wird gemocht!",
      messageTemplate: "{likerName} mag deinen {plantNameOptional} Fund! Mega, ich freu mich, wenn jemand unsere Arbeit schätzt!",
    },
    collectionFollowed: {
      title: "🫆 Neuer Follower für deine Kollektion!",
      messageTemplate: "Sehr gut, {followerName} folgt jetzt einer Kollektion von dir. Du hast einen positiven Einfluss auf die Gemeinschaft!",
    },
    firstQuestCompleted: {
      title: "🪐 Die erste Mission abgeschlossen!",
      message:
        "Deine erste Quest ist in meinen Logs. Ein kleiner Schritt für die Menscheit, aber ein großer Schritt für uns!",
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
  const fallbackPack = STORY_COPY.phaseStory.phase_6;
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
