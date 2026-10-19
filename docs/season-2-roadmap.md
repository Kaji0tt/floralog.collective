# Season 2 Roadmap — Geo-Zonen, Area-Claims, Lootboxen & Community Events

Status: Draft (2026-09-05). Konsolidiert aus dem am 24.08.2026 erarbeiteten Plan
(Chat-Session `97ea90d5-6f3d-4996-9129-26293ffd74b6`) plus neuer Community-Event-Anforderung.
Ersetzt/erweitert die veraltete Spec in [docs/robot-plant-phase1-contract.md](robot-plant-phase1-contract.md),
die das AreaClaim-System noch nicht kennt.

## Ziele der Season 2

1. Geo-Zonen-Fortschritt klar spürbar machen - 5 Scans pro Zone zum "Erobern". Der bestehende
  Zonen-Multiplikator darf keinen prozentualen Claim-Effekt mehr erzeugen.
2. Nach erfolgreichem Abschluss der Zone erhält der Spieler zufällig 1 bis 3 Areas.
3. Geozonen mit Freunden teilbar machen: Für einen gemeinsamen Abschluss müssen beide Spieler dieselbe Zone jeweils mit 5 Scans abschließen. Ein geteilter Abschluss zählt für beide Spieler und garantiert, dass drei Zonen erobert werden können.
4. Jeden Zonen-Abschluss mit einer "epischen" Wachstumsknospen-Momentaufnahme belohnen.
5. Community-weite Kooperationsziele (Community Events) als neue Season-2-Aktivität einführen. Zeitlich begrenzte Events.

---

## 1. Geo-Zonen-Fortschritt & Area-Claim (Ablösung des 3-Scan-Systems)

**Ist-Zustand:**
- Area-Claims laufen aktuell kompetitiv über `CLAIM_THRESHOLD = 3` Scans pro 100m-Kachel, siehe
  [supabase/functions/robotPlantGrantReward/index.ts](../supabase/functions/robotPlantGrantReward/index.ts#L172).
  Wer zuerst 3 Scans in einer Kachel hat, besitzt sie; Herausforderer verdrängen nur mit mehr Scans.
- Die 5-Fortschrittsbalken-UI pro Zone existiert bereits in
  [src/components/home/HomeMapFeatureRoot.jsx](../src/components/home/HomeMapFeatureRoot.jsx#L11),
  ist aber nicht an den Claim-Mechanismus gekoppelt.

**Soll-Zustand (Season 2):**
- Jede aktive `RobotPlantZone` hat 5 Fortschrittsschritte; jeder Scan innerhalb der Zone zählt +1.
- Beim 5. Scan löst sich die Zone auf ("Zone erschlossen") und der Spieler erhält zufällig
  **1 bis 3 Areas** als `AreaClaim`-Zeilen. Es gibt kein progressives Cap und kein durch Seeds
  begrenztes Area-Limit.
- **Claim-Effekt:** Jeder tatsächlich erfolgreich vergebene Claim bzw. jede vergebene Area erzeugt
  genau **+1 Seed**. Prozentuale Claim-Boni und eine Multiplikation der Seeds durch den Zonen-
  Multiplikator entfallen vollständig. Die zufällige Area-Menge von 1 bis 3 bestimmt damit direkt
  die Seed-Gutschrift des Zonenabschlusses.
- **Geteilte Zonen:** Ein Spieler kann eine aktive Zone mit einem Freund teilen. Der Abschluss
  wird erst ausgelöst, wenn **beide Spieler** in derselben Zone jeweils 5 gültige Scans erreicht
  haben. Danach erhalten beide Spieler ihren zufälligen Area-Reward; der gemeinsame Abschluss
  zählt so, dass für beide Spieler insgesamt drei Zonen eroberbar garantiert sind.
- Altes `CLAIM_THRESHOLD`-basiertes Konkurrenz-Claiming wird vollständig entfernt.

**Betroffene Stellen:**
- [supabase/functions/robotPlantGrantReward/index.ts](../supabase/functions/robotPlantGrantReward/index.ts) —
  `resolveAreaClaimForScan` komplett ersetzen durch zonenbasierte Area-Vergabe, Zufallsmenge
  von 1 bis 3 Areas, je `+1 Seed` pro vergebener Area und den gemeinsamen Zwei-Spieler-Abschluss.
- [src/api/areaClaimService.js](../src/api/areaClaimService.js) — Service für die zufällige
  Area-Vergabe und das Teilen bzw. den Abschlussstatus einer Zone.
- [src/pages/Home.jsx](../src/pages/Home.jsx) — Notification-Reihenfolge:
  Scan-Feedback → ggf. Freund-/Zonenabschlussstatus → Area-Reward → Wachstumsknospen-Animation.
- [src/components/home/HomeMapFeatureRoot.jsx](../src/components/home/HomeMapFeatureRoot.jsx#L11) —
  5-Balken-UI an echten Server-Fortschritt binden (`scansSinceActivation`).

---

## 2. Wachstumsknospe nach Zonenabschluss

**Konzept (aus Session 97ea90d5):**
1. Reward-Tabelle erhält neue Bedingungsfelder: Flag "Geozone Lootbox", Zonen-Typ-Filter
   (`forest` / `water` / `meadow` / `urban` / `beach` / `wetlands` / `all`), Wahrscheinlichkeit in %.
2. Neues dediziertes Lootbox-Datenmodell (eigene Tabellen statt nur Reward-Felder), weil folgende
   Regeln sauber historisiert werden müssen: 1x-Claim pro Zonen-Aktivierung, gewichtetes Auswürfeln,
   Duplikat-Kompensation (bereits besessene Rewards werden in Seeds umgewandelt).
    Die Phase-B-Implementierung verwendet dafür `ZoneLootboxPool`, `ZoneLootboxEntry` und
    `ZoneLootboxClaim`. `Rewards` bleibt der globale Reward-Katalog; die Lootbox-Einträge referenzieren
    ihn mit `weight` und `duplicate_seed_value`. Es werden keine Reward-Inhalte oder Gewichte erraten
    bzw. automatisch geseedet.
3. Server-seitiger, atomarer Claim-Flow (Edge Function): Eligibility prüfen → gewichteten Roll
   ausführen → Duplikat-Check → Seeds-Kompensation falls nötig → Claim persistent speichern
   (retry-sicher: erneuter Trigger liefert vorhandenes Ergebnis statt neu zu würfeln).
4. UX-Sequenz (4 Stufen): Zone-erschlossen-Inszenierung → tappbare Wachstumsknospe →
  Aufblüh-Animation → Reward-Reveal (oder Seeds-Kompensation bei Duplikat).
5. Bestehende Motion-/Theme-Bausteine wiederverwenden (Spark/Glow/Haptik), passend zum
   "Pflanzenuniversum"-Theme; Skip/Close-Fallback, damit die UX nie blockiert.

**Betroffene/relevante Dateien:**
- [src/pages/Home.jsx](../src/pages/Home.jsx) — Notification-Queue.
- [src/components/notifications/ScanFeedbackNotification.jsx](../src/components/notifications/ScanFeedbackNotification.jsx) — Trigger-Grenze.
- [src/components/notifications/ScanZoneUnlockNotification.jsx](../src/components/notifications/ScanZoneUnlockNotification.jsx) — bestehender Folge-Schritt.
- [src/components/notifications/RandomRewardNotification.jsx](../src/components/notifications/RandomRewardNotification.jsx) — Reward-Reveal-Muster als Vorlage.
- Neue Migration(en) für Lootbox-Tabellen + RLS analog zu bestehenden User-Reward-Mustern.
- Neue Edge Function (z. B. `claimZoneLootbox`) für den atomaren Claim.
- Vorgesehen: eine Migration für `ZoneLootboxPool`, `ZoneLootboxEntry` und `ZoneLootboxClaim`,
  eine Edge Function `claimZoneLootbox` sowie ein Frontend-Service. Der Claim muss retry-sicher
  sein; Duplikate werden über den konfigurierten Seedwert kompensiert.

**Telemetrie:** Events für offered/opened/granted/duplicate-compensated ergänzen; Balancing-Doku
für `probability_percent` und Priorität zone-spezifisch vs. `all`-Fallback separat pflegen.

---

## 3. Community Events (Season 2 – umgesetzt)

**Ziel:** Zeitlich begrenzte, kooperative Ziele, bei denen die gesamte Community gemeinsam eine
Anzahl Scans einer Zielpflanze/-gattung erreichen muss. Erstes Event: **„Die Kastanien-Kartierung“**
(19.–25.10.2026, 150 Kastanien, Ross- + Edelkastanie über `PlantGenus.genus_name = 'Kastanie'`).

**Datenmodell:** Community Events sind `CommunityQuest`-Rows mit `is_event = true`
(Migrationen `20260921140000_add_community_quests.sql` + `20261016120000_community_events.sql`).
Event und Community-Quest sind dasselbe Objekt – das Event erscheint daher automatisch auch im Quest-Tab.
- `CommunityQuest`: `slug`, `is_event`, `reward_tiers` (`[{min_contributions, reward_id}]`, kumulativ),
  `success_sparks`, `failure_sparks`, `outcome`, `finalized_at`, Push-Flags
  (`start_notified_at`, `progress_notified_count`, `goal_notified_at`, `end_notified_at`).
- `UserCommunityQuest`: Teilnahme + `contributed_count`, nach Abschluss `granted_sparks`,
  `granted_reward_ids`, `outcome`.
- `CommunityQuestContribution`: jeder gezählte Scan (Basis für die Scan-Liste im Explorer-Log,
  RPC `get_community_quest_scans`).
- `Rewards.exclusive_source`: Event-exklusive Rewards (z. B. `face_Mojo/Twodee/Skyjo`) bleiben
  `shop_hidden`, `syncLogoAssets` blendet sie nicht wieder ein.

**Scan-Zählung:** Trigger `sync_community_quest_on_discovery` auf `UserPlantDiscovery` zählt jeden
passenden Scan im Zeitraum. Events zählen auch nach Erreichen des Ziels bis `end_date` weiter
(persönliche Reward-Stufen bleiben erreichbar).

**Anti-Abuse (gilt für alle Community Events/Quests):** Ein Scan zählt pro Spieler nur, wenn er
mindestens `radius_m` (Standard 50 m) von **allen** eigenen bereits gezählten Scans dieses Events
entfernt ist – unabhängig von der erkannten Pflanzen-ID.

**Abschluss:** `finalize_community_quest(quest_id)` (nur service_role, idempotent) nach `end_date`:
- Erfolg (`completed`): `success_sparks` Funken + alle erreichten `reward_tiers`.
- Misserfolg: `failure_sparks` Funken, keine Tier-Rewards.
- Pro Teilnehmer eine `UserNotification` (`community_event_result`) → Reward-Overlay beim nächsten
  Öffnen von Home (`CommunityEventRewardNotification`).

**Scheduler & Push:** Edge Function `communityEventScheduler` (Header `x-community-event-secret`,
Secret `COMMUNITY_EVENT_SCHEDULER_SECRET`), stündlich getriggert vom Cloudflare-Worker
`workers/community-events` (Env `COMMUNITY_EVENT_ENDPOINT`, `COMMUNITY_EVENT_SECRET`, optional
`WORKER_TRIGGER_SECRET`). Pushes (Florabot-Story-Sprech, Broadcast + News) nur zwischen 08–22 Uhr
Europe/Berlin: Start, Zwischenstand bei ⅓ und ⅔ der Laufzeit, Ziel erreicht, Ergebnis nach Abschluss.
Finalisierung läuft unabhängig vom Push-Zeitfenster.

**UI:**
- Home-Eventstripe: Event-Item an erster Stelle mit animiertem Rahmen (`CommunityEventGlowBorder`),
  Community-Fortschrittsbalken und persönlichem Beitrag (sichtbar bis 3 Tage nach Ende).
- Quests: Event-Karte mit Zusammenfassung (Ziel, Bedingungen, Zeitraum, Belohnungen, Stufen).
- Explorer-Log → Community: Event-Eintrag mit allen gezählten Event-Scans.
- Admin: `AdminQuestCreator` → Tab „Community“ → Checkbox „Community Event“.

---

## Phasenplan (Umsetzungsreihenfolge)

1. **Phase A — Zonen-Progress & Area-Claim-Ablösung**
   - Backend: 5-Schritt-Zonenfortschritt, zufällige Vergabe von 1 bis 3 Areas,
     `+1 Seed` je vergebener Area, Zwei-Spieler-Abschluss und altes 3-Scan-System entfernen.
   - Frontend: Home-Flow zum Teilen von Zonen und Anzeigen des Area-Rewards.
2. **Phase B — Lootbox-Grundgerüst**
   - Migration + Edge Function + API-Service anlegen; anschließend konkrete Pool-/Reward-Einträge
     und die minimale Reveal-UI ergänzen.
3. **Phase C — Lootbox-Politur**
   - Volle Animationssequenz, Theming, Telemetrie.
4. **Phase D — Community Events** ✅ (erstes Event: Kastanien-Kartierung, Oktober 2026)
   - Datenmodell + Server-Zählung + Banner-UI + Abschluss-Reward-Grant.
   - Reward-Inhalte parallel im Reward-/Shop-System definieren.

## Referenzierte Bestandssysteme (Wiederverwendung statt Neubau)
- `RobotPlantZone` / `RobotPlantUserZoneState` — Zonen-Aktivierung & Enum der 6 Zonentypen.
- `AreaClaim` + `syncClaimedAreaCountForUser` — Basis für Claim-Zähler, wird auf Zonen-Trigger umgestellt.
- `Rewards` + `grantScanZoneUnlocks` — Muster für bedingte Reward-Freischaltung, als Vorlage für Lootbox- und Community-Event-Grants.
- Notification-Queue in [Home.jsx](../src/pages/Home.jsx) — zentrale Stelle für neue Overlay-Reihenfolgen.
