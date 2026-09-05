# Season 2 Roadmap — Geo-Zonen, Tile-Claims, Lootboxen & Community Events

Status: Draft (2026-09-05). Konsolidiert aus dem am 24.08.2026 erarbeiteten Plan
(Chat-Session `97ea90d5-6f3d-4996-9129-26293ffd74b6`) plus neuer Community-Event-Anforderung.
Ersetzt/erweitert die veraltete Spec in [docs/robot-plant-phase1-contract.md](robot-plant-phase1-contract.md),
die das TileClaim-System noch nicht kennt.

## Ziele der Season 2

1. Geo-Zonen-Fortschritt klar spürbar machen - 3-5 Scans pro Zone zum "Erobern", Multiplikator ebenfalls Zufallswert von 1.5 bis 2.5 - mit jedem Scan innerhalb der Zone nimmt der Multiplikator um 0.1 ab.
2. Nach "Erobern" der Zone wird das Ursprungstile zu den geclaimten Tiles des Spielers hinzugefügt.
3. Zonen-Slots als knappe, durch Spielfortschritt (Seeds) wachsende Ressource inszenieren. Pro 5k Seeds, ein zusätzlicher Claim möglich
4. Jeden Zonen-Abschluss mit einer "epischen" Lootbox-Reward-Momentaufnahme belohnen.
5. Community-weite Kooperationsziele (Community Events) als neue Season-2-Aktivität einführen. Zeitlich begrenzte Events.

---

## 1. Geo-Zonen-Fortschritt & Tile-Claim (Ablösung des 3-Scan-Systems)

**Ist-Zustand:**
- Tile-Claims laufen aktuell kompetitiv über `CLAIM_THRESHOLD = 3` Scans pro 100m-Kachel, siehe
  [supabase/functions/robotPlantGrantReward/index.ts](../supabase/functions/robotPlantGrantReward/index.ts#L172).
  Wer zuerst 3 Scans in einer Kachel hat, besitzt sie; Herausforderer verdrängen nur mit mehr Scans.
- Die 5-Fortschrittsbalken-UI pro Zone existiert bereits in
  [src/components/home/HomeMapFeatureRoot.jsx](../src/components/home/HomeMapFeatureRoot.jsx#L11),
  ist aber nicht an den Claim-Mechanismus gekoppelt.

**Soll-Zustand (Season 2):**
- Jede aktive `RobotPlantZone` hat 5 Fortschrittsschritte; jeder Scan innerhalb der Zone zählt +1.
- Beim 5. Scan löst sich die Zone auf ("Zone erschlossen") und ihr **Ursprungs-Tile** wird zum
  geclaimten Tile des Spielers (`TileClaim`-Zeile), sofern das Zonen-Limit nicht erreicht ist.
- Altes `CLAIM_THRESHOLD`-basiertes Konkurrenz-Claiming wird vollständig entfernt.
- **Dynamisches Zonen-/Tile-Limit:**
  `maxClaimableTiles = min(10, floor(all_time_seeds / 5000))`
  - 0–4999 Seeds → 0 Tiles
  - 25.000 Seeds → 5 Tiles
  - ab 50.000 Seeds → 10 Tiles (Cap)
  - Seed-Basis: all-time Seeds aus dem Wallet-Ledger, nicht der aktuelle Kontostand.
- **Limit erreicht:** Statt automatischem Claim wird der Spieler gefragt, ob das neue Tile das
  **älteste bestehende Tile** (nach `claimed_at`) ersetzen soll. Ablehnung verwirft den neuen Claim
  (Zone bleibt inhaltlich abgeschlossen, aber ohne Tile-Gewinn — Kompensation über Lootbox/Seeds).

**Betroffene Stellen:**
- [supabase/functions/robotPlantGrantReward/index.ts](../supabase/functions/robotPlantGrantReward/index.ts) —
  `resolveTileClaimForScan` komplett ersetzen durch zonenbasierte Claim-Logik + Replace-Flow.
- [src/api/tileClaimService.js](../src/api/tileClaimService.js) — neue Funktion für Replace-Entscheidung.
- [src/pages/Home.jsx](../src/pages/Home.jsx) — Notification-Reihenfolge:
  Scan-Feedback → Tile-Entscheidung (ggf. Replace-Dialog) → Lootbox-Animation.
- [src/components/home/HomeMapFeatureRoot.jsx](../src/components/home/HomeMapFeatureRoot.jsx#L11) —
  5-Balken-UI an echten Server-Fortschritt binden (`scansSinceActivation`).

---

## 2. Geozonen-Lootbox nach Zonenabschluss

**Konzept (aus Session 97ea90d5):**
1. Reward-Tabelle erhält neue Bedingungsfelder: Flag "Geozone Lootbox", Zonen-Typ-Filter
   (`forest` / `water` / `meadow` / `urban` / `beach` / `wetlands` / `all`), Wahrscheinlichkeit in %.
2. Neues dediziertes Lootbox-Datenmodell (eigene Tabellen statt nur Reward-Felder), weil folgende
   Regeln sauber historisiert werden müssen: 1x-Claim pro Zonen-Aktivierung, gewichtetes Auswürfeln,
   Duplikat-Kompensation (bereits besessene Rewards werden in Seeds umgewandelt).
3. Server-seitiger, atomarer Claim-Flow (Edge Function): Eligibility prüfen → gewichteten Roll
   ausführen → Duplikat-Check → Seeds-Kompensation falls nötig → Claim persistent speichern
   (retry-sicher: erneuter Trigger liefert vorhandenes Ergebnis statt neu zu würfeln).
4. UX-Sequenz (4 Stufen): Zone-erschlossen-Inszenierung → tappbares Stellvertreter-Objekt →
   Öffnen-Animation → Reward-Reveal (oder Seeds-Kompensation bei Duplikat).
5. Bestehende Motion-/Theme-Bausteine wiederverwenden (Spark/Glow/Haptik), passend zum
   "Pflanzenuniversum"-Theme; Skip/Close-Fallback, damit die UX nie blockiert.

**Betroffene/relevante Dateien:**
- [src/pages/Home.jsx](../src/pages/Home.jsx) — Notification-Queue.
- [src/components/notifications/ScanFeedbackNotification.jsx](../src/components/notifications/ScanFeedbackNotification.jsx) — Trigger-Grenze.
- [src/components/notifications/ScanZoneUnlockNotification.jsx](../src/components/notifications/ScanZoneUnlockNotification.jsx) — bestehender Folge-Schritt.
- [src/components/notifications/RandomRewardNotification.jsx](../src/components/notifications/RandomRewardNotification.jsx) — Reward-Reveal-Muster als Vorlage.
- Neue Migration(en) für Lootbox-Tabellen + RLS analog zu bestehenden User-Reward-Mustern.
- Neue Edge Function (z. B. `claimZoneLootbox`) für den atomaren Claim.

**Telemetrie:** Events für offered/opened/granted/duplicate-compensated ergänzen; Balancing-Doku
für `probability_percent` und Priorität zone-spezifisch vs. `all`-Fallback separat pflegen.

---

## 3. Community Events (neu, Season 2)

**Ziel:** Zeitlich begrenzte, kooperative Ziele, bei denen die gesamte Community gemeinsam eine
Scan-Anzahl in einem bestimmten Zonentyp erreichen muss. Bei Erfolg erhalten alle Teilnehmenden
einen besonderen Reward.

**Vorgeschlagenes Datenmodell** (Details/Rewards noch offen, siehe unten):
- `CommunityEvent`: `id`, `zone_theme` (eines der 6 Zonentypen oder `all`), `target_scan_count`,
  `starts_at`, `ends_at`, `status` (`upcoming` / `active` / `succeeded` / `failed`),
  `reward_description` (Platzhaltertext bis Rewards definiert sind).
- `CommunityEventProgress`: serverseitig gepflegter Zähler (`current_scan_count`), analog zum
  bereits etablierten Muster `syncClaimedTileCountForUser` in
  [robotPlantGrantReward/index.ts](../supabase/functions/robotPlantGrantReward/index.ts#L511)
  — vermeidet teure Live-Aggregation über alle Discoveries bei jedem Scan.
- `CommunityEventParticipant`: `event_id`, `auth_id`, `contributed_scans` — bestimmt, wer beim
  Erfolg claim-berechtigt ist (mind. 1 beitragender Scan im Zeitraum).

**Scan-Zählung:** Jeder Scan mit `discovery_location` innerhalb einer aktiven Zone des passenden
Themas erhöht `current_scan_count` serverseitig im selben Aufruf wie der bestehende
Tile-Claim-/Zonen-Fortschritt (gleicher Edge-Function-Durchlauf in `robotPlantGrantReward`, um
Rennbedingungen zu vermeiden).

**Erfolgsfall:** Sobald `current_scan_count >= target_scan_count`, Status → `succeeded`, und ein
Grant-Flow (analog `grantScanZoneUnlocks`) verteilt den definierten Reward an alle Zeilen in
`CommunityEventParticipant`. Reward-Typ ist bewusst noch offen — Kandidaten: exklusives Kosmetik-Item,
Lootbox mit garantiertem Season-Reward, oder Seed-Bonus-Multiplikator für begrenzte Zeit.

**UI:**
- Banner/Progress-Bar auf Home bzw. Map (z. B. in [HomeMapFeatureRoot.jsx](../src/components/home/HomeMapFeatureRoot.jsx)),
  zeigt `current_scan_count / target_scan_count` und Restzeit.
- Abschluss-Notification im selben Notification-Queue-Muster wie Lootbox/Zone-Unlock.

**Offene Punkte (bewusst nicht final):**
- Konkrete Reward-Definition pro Event.
- Ob Events global (alle Spieler weltweit) oder regional/Community-Segment-basiert laufen.
- Balancing von `target_scan_count` relativ zu aktiver Spielerzahl.
- Anti-Abuse: Rate-Limit/Dedup für Massen-Scans am selben Ort zur künstlichen Zielerreichung.

---

## Phasenplan (Umsetzungsreihenfolge)

1. **Phase A — Zonen-Progress & Tile-Claim-Ablösung**
   - Backend: 5-Schritt-Zonenfortschritt, neues Claim/Replace, altes 3-Scan-System entfernen.
   - Frontend: Home-Flow + Ersatzdialog.
2. **Phase B — Lootbox-Grundgerüst**
   - Migration + Edge Function + minimale Reveal-UI (Platzhalter-Objekt reicht initial).
3. **Phase C — Lootbox-Politur**
   - Volle Animationssequenz, Theming, Telemetrie.
4. **Phase D — Community Events**
   - Datenmodell + Server-Zählung + Banner-UI + Abschluss-Reward-Grant.
   - Reward-Inhalte parallel im Reward-/Shop-System definieren.

## Referenzierte Bestandssysteme (Wiederverwendung statt Neubau)
- `RobotPlantZone` / `RobotPlantUserZoneState` — Zonen-Aktivierung & Enum der 6 Zonentypen.
- `TileClaim` + `syncClaimedTileCountForUser` — Basis für Claim-Zähler, wird auf Zonen-Trigger umgestellt.
- `Rewards` + `grantScanZoneUnlocks` — Muster für bedingte Reward-Freischaltung, als Vorlage für Lootbox- und Community-Event-Grants.
- Notification-Queue in [Home.jsx](../src/pages/Home.jsx) — zentrale Stelle für neue Overlay-Reihenfolgen.
