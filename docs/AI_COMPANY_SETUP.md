# Floralog AI Company - Einrichtung

Ziel: 100 EUR monatlicher Bruttoumsatz bei maximal 25 EUR monatlichem Agentenbudget.
Der Markenkern bleibt verbindlich: "Spielerisch Lernen und Entdecken, als Community".

## Aktueller Stand

- [x] CrewAI 1.15.22 lokal mit Python 3.13 und `uv` installiert
- [x] Isoliertes Projekt in `ai-company/`
- [x] Strukturierter Revenue-Growth-Flow mit vier Rollen
- [x] Offline-Dry-run und deterministische Sicherheitsregeln
- [x] Manuell testbarer GitHub-Review-Workflow
- [x] Supabase API Keys auf Publishable-/Secret-Key-Modell migriert
- [x] Aggregierte KPI-Edge-Function und Umsatzledger im Code erstellt
- [ ] Migration `20260920110612_create_payment_transaction_ledger.sql` manuell anwenden
- [ ] Migration `20260920153000_extend_ai_kpi_snapshot_with_kpiadmin_journey.sql` manuell anwenden
- [ ] `AI_KPI_SECRET` in Supabase und GitHub mit demselben Wert konfigurieren
- [ ] GitHub-Secrets konfigurieren
- [ ] Ersten manuellen Dry-run in GitHub Actions freigeben

## 1. Schluessel rotieren

Im Supabase-Dashboard den im Chat sichtbar gewordenen Service-Role-Key rotieren. Danach den
PlantNet-Key beim Anbieter erneuern und lokale Werte in `.env.local` aktualisieren. Diese Werte
duerfen nicht als CrewAI- oder GitHub-Secret verwendet werden.

Der neue `sb_secret_...`-Key wird an zwei Stellen unterschiedlich benannt:

- Lokal in `.env.local`: `SUPABASE_SECRET_KEY=sb_secret_...`
- Hosted Edge Functions: benutzerdefiniertes Secret `SERVICE_ROLE_KEY=sb_secret_...`

Die vorhandenen Edge Functions lesen bereits zuerst `SERVICE_ROLE_KEY`. Damit kann der moderne
Secret Key ohne Codebruch parallel zum Legacy-Key eingefuehrt werden. In `.env.local` die alte
Zeile `SUPABASE_SERVICE_ROLE_KEY=eyJ...` entfernen, nachdem `SUPABASE_SECRET_KEY` gesetzt wurde.
Den neuen Secret Key niemals mit einem `VITE_`-Praefix versehen.

Unter `Edge Functions > Secrets` darf kein eigener Name mit `SUPABASE_` beginnen, da dieser
Namensraum reserviert ist. `SERVICE_ROLE_KEY` ist deshalb der absichtlich verwendete
Kompatibilitaetsname. Erst nach Funktionstests und Kontrolle aller externen Worker/Webhooks darf
der alte Legacy-`service_role`-Key unter `Settings > API Keys` deaktiviert werden.

## 2. Lokaler Dry-run

```powershell
cd ai-company
uv sync --frozen
uv run pytest
uv run ruff check .
uv run floralog-ai --snapshot fixtures/kpi_snapshot.json --output output/revenue-review.json
uv run floralog-ai-render-issue --review output/revenue-review.json --output output/revenue-review.md
```

Der Dry-run verwendet keine API, keine Produktionsdaten und schreibt nicht nach GitHub.

## 3. GitHub konfigurieren

Unter `Settings > Secrets and variables > Actions` spaeter folgende Repository-Secrets anlegen:

- `OPENAI_API_KEY`: eigener OpenAI-API-Key mit begrenztem Projektbudget
- `AI_KPI_ENDPOINT`: HTTPS-URL der noch zu implementierenden aggregierten KPI-Edge-Function
- `AI_KPI_SECRET`: eigener rotierbarer Zugriffsschluessel nur fuer diesen KPI-Endpunkt

Repository-Variablen:

- `FLORALOG_AI_MODEL=openai/gpt-5-mini` (optional; der Workflow nutzt diesen Wert standardmäßig)
- `AI_MONTHLY_COST_EUR=0` (vorerst manuell aktualisieren)

Der Workflow bekommt nur `contents: read` und `issues: write`. Er kann nicht mergen, deployen
oder SQL ausfuehren.

Die Crew besteht inzwischen aus acht Rollen: KPI, Markt, UX/UI, Game Design, Growth, Marketing,
Product Management und Master-Orchestrierung. UX/Game/Growth/Marketing liefern zunaechst
strategische Entwuerfe; der Product Manager verdichtet sie und der Master erstellt das finale
Review. Marketing darf noch keine Social Posts senden, Mails verschicken oder Werbebudget ausgeben.

## 4. Erster GitHub-Test

In `Actions > AI Revenue Review > Run workflow` den Standard `dry_run=false` verwenden. Erwartet
wird genau ein offenes Issue mit Label `ai-revenue-review`. Wiederholte Laeufe aktualisieren dieses
Issue, statt neue Issues anzulegen.

Der manuelle Workflow ist standardmaessig auf `dry_run=false` gestellt und verwendet damit echte
aggregierte KPIs. Fuer einen technischen Test ohne Produktionsdaten muss `dry_run=true` explizit
ausgewaehlt werden.

## 5. Produktionsdaten anschliessen

1. Im Supabase SQL Editor den Inhalt von
	`supabase/migrations/20260920110612_create_payment_transaction_ledger.sql` ausfuehren.
2. Im selben SQL Editor danach den Inhalt von
	`supabase/migrations/20260920153000_extend_ai_kpi_snapshot_with_kpiadmin_journey.sql` ausfuehren.
   Diese Erweiterung bringt die KPIAdmin-Navigationsdaten (`home_*`, `bottomnav_*`, Aufgaben- und
   Social-Tab-Events), die 30-Tage-Eventsumme und Stickiness in den AI-Snapshot.
3. Einen langen zufaelligen Wert erzeugen und denselben Wert an beiden Stellen als
	`AI_KPI_SECRET` speichern:
	- Supabase Dashboard: `Edge Functions > Secrets`
	- GitHub Repository: `Settings > Secrets and variables > Actions`
4. In GitHub zusaetzlich setzen:
	- `AI_KPI_ENDPOINT=https://mppxozsltkgjozcastgv.supabase.co/functions/v1/aiKpiSnapshot`
	- `OPENAI_API_KEY=<eigener OpenAI-Projektschluessel>`
5. Danach `aiKpiSnapshot` erneut deployen und testen. Der Endpoint verwendet nach dieser
	Erweiterung `ai_get_kpi_snapshot_v2()`.

Die Capture-Functions werden absichtlich erst nach Anwendung der Migration deployed, weil ein
erfolgreicher PayPal-Capture sonst nicht in das noch fehlende Ledger geschrieben werden koennte.
Nur `aiKpiSnapshot` liefert aggregierte Daten an CrewAI; SQL wird weiterhin ausschliesslich manuell
im Supabase Human Interface ausgefuehrt.

## Freigaberegeln

- Kein Coding-Agent ohne `ai-approved`-Label und menschliche Akzeptanzkriterien.
- Kein automatischer Merge.
- Kein automatisches SQL oder `supabase db push`.
- Edge-Function-Deploy erst nach menschlichem Merge ueber einen separaten geschuetzten Workflow.
- Keine Rohdaten mit E-Mail, Name, Bild oder Koordinaten an Modelle senden.

## Reach Agent (Reichweite)

Ein einzelner Agent (`Floralog Reach Manager`) mit zwei Aufgaben:

| Aufgabe | Zeitplan (UTC) | Ergebnis |
| --- | --- | --- |
| Posts erstellen, auswerten, veroeffentlichen | Mo/Mi/Fr 16:23 | Posts auf Instagram, Pinterest, Bluesky, Mastodon + Job-Zusammenfassung |
| Partner-Scouting | Mo 09:07 | GitHub-Issue `ai-partner-scouting` mit Kandidaten und Nachrichtenentwuerfen |

Ablauf Posts:

1. `aiContentSnapshot` liefert aggregierte Spieldaten (Top-Pflanzen, Scan der Woche, Quests,
   Community-Zahlen). Keine Namen, Bilder oder Koordinaten.
2. Die Clients lesen Follower und Kennzahlen der letzten Posts: Instagram (Likes, Kommentare,
   Shares, Saves, Reichweite), Pinterest (Impressionen, Saves, Link-Klicks), Bluesky, Mastodon.
3. Der Agent wertet aus, entscheidet ob sich ein Post lohnt, und schreibt pro Plattform
   hoechstens einen angepassten Post inkl. Headline fuer die Slides.
4. Guardrails pruefen jeden Post; erst danach werden Slides gerendert (Instagram: Karussell mit
   Cover + Daten-Slides wie im AdminWeeklyReport, Pinterest: ein 2:3-Pin), ueber
   `aiSocialMediaUpload` in den oeffentlichen Bucket `social-media` geladen und veroeffentlicht.

Deterministische Guardrails (`ai-company/src/floralog_ai/reach_guardrails.py`):

- max. 1 Post pro Plattform und Lauf, min. 20 h Abstand, max. 4 Posts pro 7 Tage
- jede Zahl in Text und Headline muss aus dem Content-Snapshot stammen
- keine Links, Mentions, E-Mails, Spenden-/Kauf-/Druckbegriffe; Links werden automatisch
  gesetzt (Instagram: "Link in der Bio", Pinterest: Pin-Link mit UTM-Parametern)
- Instagram/Pinterest brauchen eine Headline; max. 3 Hashtags (Bluesky/Mastodon) bzw. 5
- Dubletten zu bisherigen Posts werden verworfen
- Instagram-Posts werden standardmaessig als KI-generiert gekennzeichnet (`INSTAGRAM_AI_LABEL`)
- Kill-Switch: Repository-Variable `FLORALOG_REACH_POSTING_ENABLED` (nur `true` postet)

Partner-Scouting (`ai-company/src/floralog_ai/partner_main.py`):

- Sucht mit den Begriffen aus `ai-company/config/partner_seeds.json` auf Bluesky und Mastodon
  und reichert Instagram-Profile ueber die Business Discovery API an (nur Business-/Creator-Konten).
- Instagram-Kandidaten kommen aus `instagram_usernames` (von Hand gepflegt). Die Hashtag-Suche
  (`instagram_hashtags`) braucht das Meta-Feature "Instagram Public Content Access" mit App Review
  und ist deshalb erst mit Variable `INSTAGRAM_HASHTAG_SEARCH=true` aktiv.
- Profile ohne Natur-Bezug oder mit weniger als 30 Followern werden verworfen. Empfehlungen des
  Agenten fuer nicht gefundene Profile werden entfernt.
- **Niemand wird automatisch kontaktiert.** Die Nachrichtenentwuerfe im Issue pruefst und
  sendest du selbst (UWG/DSGVO, siehe Hinweise zur Kaltakquise).
- Pinterest bietet keine oeffentliche Profilsuche per API und ist daher nicht Teil des Scoutings.

### Einrichtung Schritt fuer Schritt

**1. Supabase**

1. Im SQL Editor nacheinander ausfuehren:
   - `supabase/migrations/20260929120000_create_ai_content_snapshot.sql`
   - `supabase/migrations/20260929130000_create_social_media_bucket.sql`
2. Edge Functions `aiContentSnapshot` und `aiSocialMediaUpload` deployen. Beide nutzen das
   bestehende Secret `AI_KPI_SECRET`. Der Upload nimmt nur JPEG bis 8 MB an, max. 30 pro Stunde.

**2. Instagram (Instagram API mit Facebook Login)**

Voraussetzung: Instagram-Business-Konto, verknuepft mit einer Facebook-Seite im Meta Business
Portfolio (bei bereits geschalteter Werbung meist vorhanden).

1. developers.facebook.com > App erstellen > Typ "Business", mit dem Business Portfolio
   verknuepfen. Produkt "Instagram" > "API setup with Facebook login" hinzufuegen.
2. business.facebook.com > Einstellungen > Nutzer > Systemnutzer > neuen Systemnutzer (Admin)
   anlegen. Ihm die App, die Facebook-Seite und das Instagram-Konto als Asset zuweisen.
3. Beim Systemnutzer "Token generieren" (Ablauf: nie) mit den Berechtigungen
   `instagram_basic`, `instagram_content_publish`, `instagram_manage_insights`,
   `pages_read_engagement`, `pages_show_list`, `business_management`.
4. Instagram-User-ID ermitteln: im Graph API Explorer mit dem Token
   `GET /me/accounts?fields=instagram_business_account` aufrufen; `instagram_business_account.id`
   ist die `INSTAGRAM_USER_ID`.
5. Solange die App im Entwicklungsmodus bleibt und nur eigene Assets nutzt, ist keine App Review
   noetig. Falls Meta eine Freigabe fuer die Seite verlangt, "Page Publishing Authorization"
   in den Seiteneinstellungen abschliessen.

**3. Pinterest**

1. Pinterest-Business-Konto, dann developers.pinterest.com > "Connect app" / App anlegen.
   Neue Apps starten mit "Trial access": Pins sind dann nur fuer dich sichtbar. Fuer echte
   Reichweite in der App "Upgrade to Standard access" beantragen (kurzes Demo-Video der Nutzung).
2. Ein Board fuer Floralog anlegen (z. B. "Pflanzen entdecken mit Floralog"). Die Board-ID
   steht in der Antwort von `GET https://api.pinterest.com/v5/boards` oder im API-Explorer.
3. OAuth-Token mit den Scopes `boards:read`, `pins:read`, `pins:write`, `user_accounts:read`
   erzeugen (API-Explorer oder OAuth-Flow). Fuer den Dauerbetrieb den Refresh Token verwenden:
   `PINTEREST_APP_ID`, `PINTEREST_APP_SECRET` und `PINTEREST_REFRESH_TOKEN` setzen. Der Agent
   holt sich bei jedem Lauf einen frischen Access Token. Den Refresh Token vor Ablauf
   (Pinterest: ca. 1 Jahr) erneuern.

**4. Bluesky / Mastodon** (optional, wie bisher)

- Bluesky: `Settings > Privacy and security > App passwords`.
- Mastodon: `Preferences > Development > New application` mit `read:accounts`,
  `read:statuses`, `write:statuses`.

**5. GitHub**

Secrets (`Settings > Secrets and variables > Actions`):

| Secret | Wert |
| --- | --- |
| `AI_CONTENT_ENDPOINT` | `https://<projekt>.supabase.co/functions/v1/aiContentSnapshot` |
| `AI_MEDIA_UPLOAD_ENDPOINT` | `https://<projekt>.supabase.co/functions/v1/aiSocialMediaUpload` |
| `INSTAGRAM_USER_ID`, `INSTAGRAM_ACCESS_TOKEN` | aus Schritt 2 |
| `PINTEREST_BOARD_ID` | aus Schritt 3 |
| `PINTEREST_APP_ID`, `PINTEREST_APP_SECRET`, `PINTEREST_REFRESH_TOKEN` | aus Schritt 3 (alternativ nur `PINTEREST_ACCESS_TOKEN`, laeuft nach 30 Tagen ab) |
| `BLUESKY_HANDLE`, `BLUESKY_APP_PASSWORD` | optional |
| `MASTODON_INSTANCE_URL`, `MASTODON_ACCESS_TOKEN` | optional |

Variablen:

| Variable | Wirkung |
| --- | --- |
| `FLORALOG_REACH_POSTING_ENABLED` | `true` = veroeffentlichen, sonst nur Entwuerfe (Kill-Switch) |
| `INSTAGRAM_AI_LABEL` | `true` (Standard) kennzeichnet Instagram-Posts als KI-generiert |
| `INSTAGRAM_HASHTAG_SEARCH` | `true` erst nach genehmigter App Review fuer Public Content Access |

Plattformen ohne Zugangsdaten werden automatisch uebersprungen. Instagram und Pinterest werden
ohne `AI_MEDIA_UPLOAD_ENDPOINT` deaktiviert.

**6. Testen und freischalten**

1. `Actions > AI Reach Agent > Run workflow` mit `task=posts`, `dry_run=true`: rendert Slides
   aus Fixtures, Ergebnis im Artefakt `media/`.
2. Gleiches mit `dry_run=false`, `publish=false`: echte Daten, echter Agent, nichts wird gepostet.
3. `task=partners`, `dry_run=false`: erzeugt das Scouting-Issue.
4. Erst danach Variable `FLORALOG_REACH_POSTING_ENABLED=true` setzen.

### Season-2-Hintergrund (Canva)

Die Slides nutzen einen prozedural erzeugten Season-2-Hintergrund (Creme-Mint-Verlauf,
Hoehenlinien, eroberte Area-Kacheln, Blaetter). Vorlagen zum Weiterbearbeiten liegen in
`design/background/season2_social_instagram_1080x1350.png` und
`design/background/season2_social_pinterest_1000x1500.png`
(neu erzeugen: `uv run floralog-ai-render-background --output-dir ../design/background`).

Eigenen Canva-Hintergrund verwenden:

1. Vorlage in Canva importieren (Format 1080 x 1350), gestalten. Mittlere Flaeche ruhig halten,
   dort liegt die halbtransparente Textkarte; Logo-Zeile oben und Fusszeile unten bleiben frei.
2. Als PNG exportieren und unter `ai-company/assets/season2_background.png` committen. Der
   Renderer schneidet ihn automatisch auf Instagram (4:5) und Pinterest (2:3) zu.

Optional Schrift: `Inter-Regular.ttf` und `Inter-Bold.ttf` nach `ai-company/assets/fonts/`
legen (wie in der App). Ohne diese Dateien wird DejaVu Sans (GitHub-Runner) bzw. Arial verwendet.

### Lokal testen

```powershell
cd ai-company
uv run floralog-ai-reach --content-snapshot fixtures/content_snapshot.json --history fixtures/social_history.json
uv run floralog-ai-partners --candidates fixtures/partner_candidates.json
```

Ergebnisse: `output/reach-report.md`, `output/media/*.jpg`, `output/partner-report.md`.
