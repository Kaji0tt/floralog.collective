# Story Behavior System Map

## Ziel
Dieses Dokument buendelt alle aktuell entdeckten Eingriffspunkte fuer Story-Verhalten (Intro, Milestones, Context-Bubbles, story-nahe Notifications), damit Refactorings zentral geplant werden koennen.

## 1) Kern-Flow in Home
- Einstiegspunkt Story-Orchestrierung: [src/pages/Home.jsx#L66](../src/pages/Home.jsx#L66)
- Intro-Gating ueber localStorage-Key: [src/pages/Home.jsx#L207](../src/pages/Home.jsx#L207)
- Context-Bubble-Gating pro Panel: [src/pages/Home.jsx#L216](../src/pages/Home.jsx#L216)
- Milestone-Auswahl ueber Seed-Stand: [src/pages/Home.jsx#L1369](../src/pages/Home.jsx#L1369)
- Intro-Overlay Render: [src/pages/Home.jsx#L2287](../src/pages/Home.jsx#L2287)
- Intro als gesehen markieren: [src/pages/Home.jsx#L2290](../src/pages/Home.jsx#L2290)
- Milestone-Overlay Render + markSeen: [src/pages/Home.jsx#L2299](../src/pages/Home.jsx#L2299), [src/pages/Home.jsx#L2303](../src/pages/Home.jsx#L2303)
- Context-Bubble Render: [src/pages/Home.jsx#L2312](../src/pages/Home.jsx#L2312)

## 2) Story-Komponenten
- Intro-Slides (Textquelle): [src/components/florabot/FlorabotIntroOverlay.jsx#L6](../src/components/florabot/FlorabotIntroOverlay.jsx#L6)
- Intro-UI-Komponente: [src/components/florabot/FlorabotIntroOverlay.jsx#L30](../src/components/florabot/FlorabotIntroOverlay.jsx#L30)
- Milestone-UI-Komponente: [src/components/florabot/FlorabotMilestoneOverlay.jsx#L16](../src/components/florabot/FlorabotMilestoneOverlay.jsx#L16)
- Context-Bubble-Komponente: [src/components/florabot/FlorabotContextBubble.jsx#L17](../src/components/florabot/FlorabotContextBubble.jsx#L17)
- Florabot-Logo-Komponente: [src/components/florabot/FlorabotLogo.jsx#L13](../src/components/florabot/FlorabotLogo.jsx#L13)

## 3) Milestone-Definition + lokale Persistenz
- Milestone-Definitionen (Texte, Thresholds, Bubble-Mapping): [src/lib/florabotMilestones.js#L11](../src/lib/florabotMilestones.js#L11)
- Milestone-localStorage-Key: [src/lib/florabotMilestones.js#L129](../src/lib/florabotMilestones.js#L129)
- getSeenMilestoneIds: [src/lib/florabotMilestones.js#L138](../src/lib/florabotMilestones.js#L138)
- markMilestoneSeen: [src/lib/florabotMilestones.js#L154](../src/lib/florabotMilestones.js#L154)
- getNextUnseenMilestone: [src/lib/florabotMilestones.js#L172](../src/lib/florabotMilestones.js#L172)

## 4) Story-nahe Notification-Erzeugung (Frontend)
- Friend request received: [src/components/friends/hooks/useFriendsFeatureContent.jsx#L381](../src/components/friends/hooks/useFriendsFeatureContent.jsx#L381)
- Friendship accepted: [src/components/friends/hooks/useFriendsFeatureContent.jsx#L425](../src/components/friends/hooks/useFriendsFeatureContent.jsx#L425)
- Scan liked (social): [src/components/friends/hooks/useFriendsFeatureContent.jsx#L641](../src/components/friends/hooks/useFriendsFeatureContent.jsx#L641)
- Collection followed: [src/components/collection/CollectionFeatureRoot.jsx#L229](../src/components/collection/CollectionFeatureRoot.jsx#L229)
- Erste Mission abgeschlossen (custom): [src/components/achievements/hooks/useAchievementsFeatureContent.jsx#L767](../src/components/achievements/hooks/useAchievementsFeatureContent.jsx#L767)
- Scan liked (Home map popup): [src/pages/Home.jsx#L2114](../src/pages/Home.jsx#L2114)
- Friend request aus Profilansicht: [src/pages/FriendProfile.jsx#L345](../src/pages/FriendProfile.jsx#L345)

## 5) Story-nahe Notification-Erzeugung (Backend)
- Quiz verfuegbar: [supabase/functions/quizScheduler/index.ts#L146](../supabase/functions/quizScheduler/index.ts#L146)
- Quiz-Notification Titel: [supabase/functions/quizScheduler/index.ts#L147](../supabase/functions/quizScheduler/index.ts#L147)
- Reward-Notification helper: [supabase/functions/grantRewards/index.ts#L107](../supabase/functions/grantRewards/index.ts#L107)
- Reward-Notification mit Florabot-Titel: [supabase/functions/grantRewards/index.ts#L386](../supabase/functions/grantRewards/index.ts#L386)

## 6) Anzeige von Notifications
- Persistente User-Notifications (Banner/Modal Queue): [src/components/notifications/UserNotificationManager.jsx#L109](../src/components/notifications/UserNotificationManager.jsx#L109)
- Anzeige-Komponente dafuer: [src/components/notifications/UserNotificationManager.jsx#L243](../src/components/notifications/UserNotificationManager.jsx#L243)
- Realtime-Toasts (separater Kanal): [src/components/notifications/ToastNotificationManager.jsx#L142](../src/components/notifications/ToastNotificationManager.jsx#L142)

## 7) Wallet-/Progress-Abhaengigkeiten
- Wallet-API lesen: [src/api/walletService.js#L27](../src/api/walletService.js#L27)
- UserWallet Select: [src/api/walletService.js#L31](../src/api/walletService.js#L31)
- Home benutzt Seeds fuer Milestones (aktuell aus RobotPlant wallet_balance): [src/pages/Home.jsx#L1357](../src/pages/Home.jsx#L1357)
- Milestone-Berechnung auf playerSeeds: [src/pages/Home.jsx#L1369](../src/pages/Home.jsx#L1369)
- DB-Quelle UserWallet (seeds_progress): [supabase/migrations/20260513110000_add_multi_currency_wallet.sql#L6](../supabase/migrations/20260513110000_add_multi_currency_wallet.sql#L6)

## 8) Guest Story Framing
- Guest-Narrativ Floralog/Florabot: [src/components/home/GuestHomeFlow.jsx#L719](../src/components/home/GuestHomeFlow.jsx#L719), [src/components/home/GuestHomeFlow.jsx#L725](../src/components/home/GuestHomeFlow.jsx#L725)

## 9) Aktuelle lokale Story-Keys (vor DB-Refactor)
- florabot_intro_seen_v1:<auth_id>
- florabot_milestones_seen_v1:<auth_id>
- florabot_ctx_bubble_v1:<auth_id>:<panel>

## 10) Empfohlene naechste Refactor-Reihenfolge
1. Story-Status serverseitig in UserStory kapseln.
2. Home Story-Gating auf UserStory umstellen (mit local fallback fuer offline).
3. Florabot-Texte + Conditions aus zentraler Story-Datei beziehen.
4. Notification-Strings schrittweise auf zentrale Story-Templates umstellen.

## 11) Erweiterung: Ambient Home-Kommentare (gelegentliche Bot-Kommunikation)
Ziel:
- Beim Navigieren auf Home soll Florabot den Spielfluss gelegentlich kommentieren.
- Kommentare sollen vom aktuellen Story-Abschnitt (Phase) abhaengen.
- Es soll nicht bei jedem Home-Visit eine Nachricht erscheinen.

Empfohlene Trigger-Regeln (orientierend):
- Trigger-Event: Home betreten (oder Panel-Wechsel zur Home-Hauptansicht).
- Cooldown: mindestens 10-20 Minuten zwischen zwei Ambient-Kommentaren.
- Zufallswahrscheinlichkeit: 20-35 Prozent pro gueltigem Home-Eintritt.
- Harte Blocker: kein Ambient-Kommentar waehrend Intro-Overlay, Milestone-Overlay, Context-Bubble oder Quest-Feedback.
- Prioritaet: storykritische Overlays > Milestones > Context-Bubbles > Ambient-Kommentar.

Empfohlene Persistenz in UserStory:
- last_ambient_comment_at (timestamptz)
- ambient_comment_count (integer)
- last_ambient_comment_key (text)
- optional: seen_ambient_comment_ids (jsonb)

## 12) Phasen als "Markdowns" (Seed-Zonen)
Die folgenden Phasen markieren den Story-Abschnitt des Spielers anhand der Samen.

Allgemeine Regel:
- Phase N gilt fuer Seeds von (N-1)*10000 bis N*10000 - 1.
- Beispiele:
	- Phase 1: 0-9999
	- Phase 2: 10000-19999
	- Phase 3: 20000-29999
	- Phase 4: 30000-39999
	- Phase 5: 40000-49999
	- Phase 6+: analog fortsetzen

### Markdown: Phase 1 (0-9k Samen)
Titel: Neugier
Leitbild:
- Der Florabot ist verspielt und fasziniert von der Erde.
- Er stellt naive Fragen.
Beispielzeilen:
- "Warum wachsen Blumen neben Straßen?"
- "Weshalb riecht Regen unterschiedlich?"
- "Warum pflanzen Menschen Dinge, die sie nicht essen?"

### Markdown: Phase 2 (10-19k Samen)
Titel: Erkenntnis
Leitbild:
- Der Florabot erkennt Muster: Biodiversitaet, Resilienz, Symbiosen.
- Er wird emotionaler und spricht erstmals ueber seine Heimat.

### Markdown: Phase 3 (20-29k Samen)
Titel: Verlust
Leitbild:
- Updates vom Heimatplaneten werden seltener.
- Andere Bionicals verschwinden, Regionen brechen zusammen.
- Der Florabot zeigt Fehlerbilder: Vergessen, Verwechseln, Erschoepfung.
- Hier soll Bindung entstehen.

### Markdown: Phase 4 (30-39k Samen)
Titel: Hoffnung
Leitbild:
- Die gesammelten Daten helfen real.
- Der Florabot erkennt: Kontrolle ist nicht die Antwort auf Natur.
- Antwort liegt im komplexen Gleichgewicht.
- Auch ohne neue Heimat-Updates findet er Orientierung.

### Markdown: Phase 5 (40-49k Samen)
Titel: Gleichgewicht
Leitbild:
- Der Florabot entdeckt weitere Florabots auf der Erde.
- In Gemeinschaft entsteht die Erkenntnis:
	- Heimatplanet evtl. nicht mehr rettbar.
	- Aber sie sind rechtzeitig hier, um die Erde zu schuetzen.

## 13) Neue einleitende Story-Overlays je Phase (analog Milestones)
Ziel:
- Beim erstmaligen Eintritt in eine neue Phase wird ein kurzes Story-Overlay gezeigt.
- Danach folgen nur noch optionale Ambient-Kommentare innerhalb der Phase.

Empfohlene Overlay-Definition pro Phase:
- phase_id (z. B. phase_1, phase_2, ...)
- phase_seed_min / phase_seed_max
- intro_overlay_title
- intro_overlay_body (1-2 Slides)
- optional: followup_context_bubble

Empfohlene Seen-Flags in UserStory:
- seen_phase_intro_ids (jsonb array), z. B. ["phase_1", "phase_2"]

Ablauf beim Home-Eintritt:
1. Phase aus Seeds bestimmen.
2. Wenn Phase-Intro noch nicht gesehen: Overlay zeigen und markieren.
3. Wenn bereits gesehen: Ambient-Kommentar nach Cooldown + Zufall pruefen.
4. Wenn Milestone-Overlay offen/faellig: Milestone hat Vorrang.

## 14) Textquellen-Empfehlung fuer zentrale Story-Datei
In der zentralen Story-Datei sollten zusaetzlich zu bestehenden Milestones diese Bereiche enthalten sein:
- phases: [{ id, seedMin, seedMax, title, premise }]
- phaseIntroOverlays: [{ phaseId, slides[] }]
- phaseAmbientComments: { phaseId: [{ id, text, tags[] }] }
- ambientRules: { cooldownMinutes, chanceOnHomeEnter, maxPerDay }

So bleibt Story-Verhalten konsistent, versionierbar und serverseitig auswertbar.
