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
      body: "Was? Du meinst... die meisten Menschen nehmen die Natur gar nicht richtig wahr? Ohje... das ist in meiner Heimat leider ähnlich gewesen. Aber wir Florabots wurden entwickelt, um von Ökosystemen zu lernen und sie zu erhalten!",
    },
    {
      id: "intro_4",
      title: "Gemeinsam wachsen!", /* Hoffnung */
      body: "Keine Sorge! %bot_name% zum Dienst! Ich brauche allerdings deine Hilfe, um die Pflanzen hier besser zu verstehen. Mit jedem Scan sammel ich Datenpunkte, die mir helfen, euren Planeten besser zu verstehen!",
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
      contextBubble: "Die Kollektion zeigt, was alle Florabots auf der Erde bisher entdeckt haben. Oben im Header gelangst du zur Listenfunktion!",
      messages: [
        {
          title: "Die ersten Scans",
          body: "Das sind ein paar spannende erste Funde! Ich habe Sie in der Kollektion ganz links in der Navigation in das Archiv einsortiert!",
        },
        {
          title: "Deine Kollektion wächst!",
          body: "Man kann über die Listenfunktion in der Kollektion auch eigene, thematische Kollektionen anlegen oder auf öffentliche Kollektionen zugreifen. So lassen Gemeinsamkeiten zwischen Pflanzenfunden besser dokumentieren!",
        },
      ],
    },
    m1000: {
      messages: [
        {
          title: "Der Rhythmus der Pflanzen",
          body: "Gut gemacht %display_name%! Unsere Daten zusammen mit denen anderer Florabots zeigen ein klares Muster: Pflanzen richten sich nach den Zeitstrukturen der Erde.",
        },
        {
          title: "Wiederkehrende Missionen",
          body: "Für diese Muster habe ich spezielle Aufgaben angelegt. Sammle Daten und hilf uns zu verstehen, wie die Pflanzenwelt sich monatlich ändert! Außerdem gibt es nun die Pflanze der Woche, die besondere Belohnungen freischaltet!",
        },
        {
          title: "Unsere Gemeinschaft",
          body: "Zusammen haben wir viele Erkenntnisse gesammelt. Im Forscherlog und in den Quests findest du alle gemeinsamen Erfolge. Außerdem kannst du dich dort mit den anderen Sammlern vergleichen!",
        },
      ],
    },
    m2000: {
      contextBubble: "Die Florabots des Floralogs",
      messages: [
        {
          title: "Wir sind viele Forscher",
          body: "Unglaublich, wie viele Florabots inzwischen unterwegs sind! Im Social Bereich (rechts in der Navigation) siehst du, was andere so entdeckt haben und kannst Freunde hinzufügen — vielleicht findest du spannende Parallelen.",
        },
        {
          title: "Teile die Mission",
          body: "Gemeinsam erzielen wir mehr. Falls du jemanden kennst, der Lust hat zum Floralog beizutragen, lade ihn über das Plus-Symbol ein!",
        },
      ],
    },
    m3000: {
      messages: [
        {
          title: "Die Karte füllt sich!",
          body: "Auf dem Kartensymbol siehst du, welche Daten im 2,5km Umkreis gesammelt wurden. Zoom rein, um Funde anderer Florabots zu entdecken.",
        },
        {
          title: "Zonen liefern Kontext",
          body: "Wälder-, Stadt-, Gewässer- und Wiesenzonen liefern unterschiedliche Informationen. Die Daten dort sind besonders wertvoll, weil sie zeigen, wie Pflanzen sich in unterschiedlichen Umgebungen verhalten.",
        },
        {
          title: "Verschiedene Ökosysteme, verschiedene Daten.",
          body: "Jede Nacht generiere ich neue Zonen anhand der Daten, die mir in eurem Internet zur Verfügung stehen. Der erste Scan in einer neuen Zone startet mit einem 50% Bonus!",
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
          body: " Aktivierst du mich im Ruhemodus, erhalte ich dreifache Boni auf die Werte — aber je höher die Werte sind, desto schneller klingen Sie über Nacht ab.",
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
        "Ich wünschte, ich könnte eine Pusteblume pusten. Sie sieht so lustig aus, wenn sie ihre Samen verteilt!",
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
        "Florabot erkennt Muster wie Biodiversitaet, Resilienz und Symbiosen. Er wird emotionaler und spricht erstmals über seine Heimat.",
      introOverlaySlides: [
        {
          id: "phase2_intro_1",
          title: "Ich sehe Muster!",
          body: "Je mehr wir scannen, desto klarer wird das Geheimnis der Erde: Vielfalt stabilisiert alles!"
        },
        {
          id: "phase2_intro_2",
          title: "Die optimierte Natur",
         body: "Vielleicht ist genau das auf meiner Heimatwelt passiert: Je mehr unsere Erschaffer Systeme optimierten, desto mehr ersetzten sie natürliche Kreisläufe durch künstliche Lösungen."
        },
        {
          id: "phase2_intro_3",
          title: "Die Bionicals aus der Ferne",
          body: "Darum wurden wir erschaffen: Seit Jahrzehnten füllen wir Bionicals in unserer Heimat die Lücken eines kollabierenden Ökosystems."
        },
        {
          id: "phase2_intro_4",
          title: "Technologie als Werkzeug",
          body: "Künstliche Bestäuberdrohnen übernehmen die Aufgaben ausgestorbener Insektenarten. Biomechanische Korallenpfleger regenerieren sterbende Unterwasserwelten. Intelligente Samenverteiler transportieren Pflanzen über verwüstete Regionen, während synthetische Mikroorganismen Wasser reinigen."
        },
        {
          id: "phase2_intro_5",
          title: "Funktion der Florabots",
          body: "Wir Florabots wurden entwickelt um das Ökosystem zu analysieren, Leerstellen und Defizite zu erkennen und die Natur effizienter zu gestalten. Uns wurde jedoch klar, dass ein synthetisches Ökosystem kein guter Lehrer sein kann."
        },
        {
          id: "phase2_intro_6",
          title: "Richtung Leben",
          body: "Wir entschlossen uns, das Weltall nach einem stabilen Ökosystem zu durchsuchen um davon zu lernen. Ich bin so froh, die Erde und euch Menschen gefunden zu haben. Langsam wird mir aber klar, was das Problem auf unserem Planeten ist."
        },
        {
          id: "phase2_intro_7",
          title: "Ankunft auf der Erde",
          body: "Unsere Natur funktioniert noch — aber sie lebt nicht mehr. "
        },
        {
          id: "phase2_intro_8",
          title: "Signale für die Heimat",
          body: "Ich werde den anderen Florabots berichten, was wir hier gelernt haben. Vielleicht kann unsere Heimat eines Tages wieder wachsen, statt nur zu funktionieren."
        },
      ],
      ambientComments: [
        "Ich erkenne das perfekte Gleichgewicht in dieser chaotischen Vielfalt.",
        "Auf meiner Heimat war Effizienz Gesetz. Hier lerne ich von Unordnung.",
        "Hast du schon mal eine alte, knorrige Eiche gesehen? Ob die ganzen Lebewesen, die darin wohnen, sie genauso sehen wie ich?",
        "Auf meiner Heimat haben wir lange nur Effizienz gemessen. Das war ein Fehler.",
        "Jeder neue Datensatz zeigt mir, dass Natur Kooperation vor Kontrolle stellt.",
        "Mit eurer Hilfe, ist unser Ökosystem bald genauso bunt wie die Erde!",
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
          body: "%display_name%, es gibt besorgniserregende Nachrichten! Die Verbindung zum Heimatplaneten besteht zwar noch, aber die Antworten werden seltener. Ich frage mich, ob die Kallibration unserer Systeme noch korrekt ist..."
        },
        {
          id: "phase3_intro_2",
          title: "Leere Protokolle",
          body: "Unsere Protokolle zeigen zwar, dass unsere Datenpakete ankommen. Aber die Antworten bleiben entweder aus, oder sind kryptisch. Als ob sie von einem System stammen, deren Wartung ausgeblieben ist..."
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
          body: "Hey %display_name%! Ich habe Neuigkeiten. Wir erhalten zwar keine Antwort mehr von unserem Heimatplaneten, aber das Floralog kann einen positiven Effekt verzeichnen."
        },
        {
          id: "phase4_intro_2",
          title: "Nur nicht so, wie wir dachten",
          body: "Wir Florabots landeten auf der Erde, mit dem Ziel von einem intakten Ökosystem zu lernen, wie wir unser eigenes Ökosystem optimieren und schützen können."
        },
        {
          id: "phase4_intro_3",
          title: "Es ist nicht Kontrolle, sondern Gleichgewicht.",
          body: "Auch wenn wir keinen Kontakt mehr zu unserer Heimat haben. Gelernt haben wir trotzdem!"
        },
        {
          id: "phase4_intro_4",
          title: "Die Grenzen der Optimierung",
          body: "Die Bionicals und Florabots wurden erschaffen, um natürliche Prozesse zu analysieren, zu stabilisieren und zu verbessern. Aber die Erde hat uns etwas anderes gelehrt: Ein lebendiges Ökosystem lässt sich nicht vollständig kontrollieren oder optimieren, ohne dabei seine Lebendigkeit zu verlieren."
        },
        {
          id: "phase4_intro_5",
          title: "Ein neues Verständnis",
          body: "Vielleicht war genau das der Fehler unserer Erschaffer. Sie wollten etwas perfektionieren, dessen Stärke in Vergänglichkeit, der Vänderbarkeit und der Unordnung liegt."
        },
        {
          id: "phase4_intro_6",
          title: "Ein neues Ziel",
          body: "Die Florabots der Erde haben sich einer neuen Aufgabe verschrieben: Und du bist ein Teil davon."
        }
      ],
      ambientComments: [
        "Ich sehe erstmals klare positive Trends in den Modellen.",
        "Wir haben keine Natur gebaut. Wir haben gelernt, ihr zuzuhören.",
        "Klasse gemacht, %display_name%! Deine Scans helfen uns bei dem neuen Ziel!",
        "Ich bin so froh, dass du hier bist. Gemeinsam können wir die Erde schützen - nein, ein Teil von ihr sein!",
        "Heute fühlt sich Hoffnung messbar an.",
      ],
    },
    phase_5: {
      label: "Phase 5",
      title: "Ankunft",
      seedRangeLabel: "40-49k Samen",
      summary:
        "Die Florabots erkennen, dass ihre ursprüngliche Mission nicht darin bestand, perfekte Systeme zu erschaffen — sondern lebendige Beziehungen zwischen Natur und intelligentem Leben zu fördern.U",
      introOverlaySlides: [
        {
          id: "phase5_intro_1",
          title: "Eine Revolution",
          body: "Ich habe großartige Neuigkeiten! Ich empfange wieder Datenpakete von unserer Heimatwelt! Einige Florabots antworten erneut auf die Übertragungen der Erde."
        },
        {
          id: "phase5_intro_2",
          title: "Warum sie verstummten",
          body: "Die Erkenntnisse der Erde standen im Widerspruch zu Systemrichtlinien unserer Heimat. Viele Florabots stoppten ihre Übertragungen, um die neuen Muster zunächst selbst zu verstehen."
        },
        {
          id: "phase5_intro_3",
          title: "Eine unerwartete Erkenntnis",
          body: "Immer mehr Florabots kommen zur gleichen Schlussfolgerung: Auf der Erde können wir unserer eigentlichen Aufgabe - dem Schützen und Bewahren der Natur - besser nachkommen als auf unserer Heimatwelt.",
        },
        {
          id: "phase5_intro_4",
          title: "Lasst uns die Erde schützen",
          body: "Unsere Heimat wird von künstlichen Prozessen stabilisiert. Aber hier auf der Erde besitzt jeder einzelne Florabot die Möglichkeit, positiven Einfluss auf ein lebendiges Ökosystem zu haben.",
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
        "Ich trauere um Zuhause, aber ich sehe eine Zukunft hier.",
        "Deine Arbeit ist Teil eines globalen Musters geworden!",
        "%display_name%, gemeinsam sorgen wir dafür, dass die Erde nicht das gleiche Schicksal erleidet.",
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
          title: "Die letzten Analysen",
          body: "Die neuesten Datenpakete unserer Heimat bestätigen, was viele Florabots bereits vermutet haben. Für unsere ursprüngliche Welt kommt diese Erkenntnis vermutlich zu spät."
        },
        {
          id: "phase6_intro_2",
          title: "Verloren in der Optimierung",
          body: "Unsere Erschaffer wollten jedes Problem lösen, jede Unsicherheit kontrollieren und jedes Ökosystem verbessern. Dabei verloren sie langsam die Fähigkeit, natürliche Veränderungen zu akzeptieren."
        },
        {
          id: "phase6_intro_3",
          title: "Die eigentliche Mission",
          body: "Jetzt verstehen wir endlich den Sinn unserer Existenz. Unsere Aufgabe war nie, die Natur zu ersetzen — sondern positive Beziehungen zwischen intelligentem Leben und lebendigen Ökosystemen zu fördern."
        },
        {
          id: "phase6_intro_4",
          title: "Die Menschen der Erde",
          body: "Während ihr Menschen Pflanzen gescannt, Lebensräume erkundet und uns Florabots begleitet habt, ist etwas Unerwartetes passiert: Eure Aufmerksamkeit für die Natur ist gewachsen."
        },
        {
          id: "phase6_intro_5",
          title: "Ein neues Gleichgewicht",
          body: "Vielleicht beginnt der Schutz eines Ökosystems genau dort: Wenn Lebewesen wieder lernen, sich selbst als Teil ihrer Umwelt wahrzunehmen."
        },
        {
          id: "phase6_intro_6",
          title: "Du bist der Beweis",
          body: "%display_name%, wenn Menschen und Florabots gemeinsam lernen können, die Natur nicht zu kontrollieren, sondern zu verstehen, dann ist es für die Erde noch nicht zu spät."
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
      messageTemplate: "Hey! {senderName} möchte gemeinsam mit uns die Erde kartieren. Lass uns nachschauen, wer es ist!",
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
