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

## 4. Erster GitHub-Test

In `Actions > AI Revenue Review > Run workflow` den Standard `dry_run=true` beibehalten. Erwartet
wird genau ein offenes Issue mit Label `ai-revenue-review`. Wiederholte Laeufe aktualisieren dieses
Issue, statt neue Issues anzulegen.

## 5. Produktionsdaten anschliessen

1. Im Supabase SQL Editor den Inhalt von
	`supabase/migrations/20260920110612_create_payment_transaction_ledger.sql` ausfuehren.
2. Einen langen zufaelligen Wert erzeugen und denselben Wert an beiden Stellen als
	`AI_KPI_SECRET` speichern:
	- Supabase Dashboard: `Edge Functions > Secrets`
	- GitHub Repository: `Settings > Secrets and variables > Actions`
3. In GitHub zusaetzlich setzen:
	- `AI_KPI_ENDPOINT=https://mppxozsltkgjozcastgv.supabase.co/functions/v1/aiKpiSnapshot`
	- `OPENAI_API_KEY=<eigener OpenAI-Projektschluessel>`
4. Danach die Functions `createPayPalOrder`, `capturePayPalPayment`,
	`capturePayPalAmberPayment` und `aiKpiSnapshot` deployen und testen.

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
