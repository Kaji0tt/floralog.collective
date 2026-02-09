# Floralog

Floralog unterstütz eine explorative Auseinandersetzung mit der Natur.

Ein einfaches, öffentlich einsehbares Profil verknüpft alle 
wesentlichen Elemente der Applikation und ermöglicht 
individuellen Ausdruck.

Die Elemente zur Profilgestaltung erlangt der Spieler durch Belohnungen,
wodurch zum Entdecken angeregt werden soll.

## 📄 Floralog Pages

Alle Seiten lassen sich finden unter:
- `src/pages/` 
Die Folgende Liste geht auf die Wichtigsten Seiten, ihre Funktionen und Verknüpfungen ein:

1. Home
- `src/pages/Home.jsx` — Hauptseite mit umrahmender Kachel, Profilbild und Namen des Spielers. Bietet Zugang zu den wichtigsten Funktionen in Form eine übersichtlichen und individualisierbaren UI's.
Direkter Zugang zu den 6 wesentlichen Kategorien: **Kollektion, Achievements, Quests, Friends, Scanner und Map**

2. Kollektion
- `src/pages/Collection.jsx` — Die persönliche Sammlung. Alle bisher gescannten Pflanzen des globalen Floralogs werden hier für alle Nutzer numerisch hinterlegt. Scans welche der Anwender bereits gefunden hat, werden mit dem persönlichen Bild und Markdown versehen.
- Wichtige Komponenten: `GenusCard.jsx` - UI zum Anzeigen der Gattung, `PlantCard.jsx` - UI für Pflanzen*

3. Erfolge
- `src/pages/Achievements.jsx` — Hier lassen sich persönliche Erfolge und Aufgaben finden. Quests unterteilt sich weiter in die persönlichen, die wöchentlichen und die monatlichen Quests.
Relevante Komponenten: *achievementChecker.jsx*

4. Community
- `src/pages/Quests.jsx` — Eigentlich ein Fehler in der Namensconvention. Unter "Quests.jsx" konnte der Spieler früher seinen Questfortschritt einsehen und die einzelnen Quests abgeben. Das Segment heißt inzwischen "Community" und dient der übersicht 3 wesentlicher Elemente:
**Wöchentliche Quest** - alle Beiträge zur wöchentlichen Quests werden hier für die Community einsehbar gelistet.
**Team** - bisher nicht integriert. Ich hatte die Idee, Räume zu erstellen, in welche Admins eigene Kollektionen zusammenstellen und Schülerinnen und Schüler einladen kann, ohne dass diese sich anmelden müssen. Diese Lösung würde die App für den schulischen Gebrauch in der europäischen Zone qualifizieren.
**Statistiken** - zeigt Statistiken der Community, wie die häufigste Pflanze diesen Monat oder die häufigsten Scans.

5. Freunde
- `src/pages/Friends.jsx` - eine Freundesliste. Freunde hinzufügen über Mail. Die Liste zeigt ihre letzten Aktivitäten an. Zeigt außerdem "verschenkte" Scans an. Eine Anlehnung ans Stupsen / Gruscheln, zur Förderung von sozialer Interaktion.

6. Scanner 
- `src/pages/Scanner.jsx` - Ermöglicht das Scannen und somit das hinzufügen neuer Pflanzen zum Floralog. Nutzte früher LLM, inzwischen API von Pl@ntNet zum identifizieren und zeigt die Ergebnisse über ScanResults. Wenn die % aus der Pl@ntNet API über 5% liegen, werden die Auswahlmöglichkeiten dem User präsentiert.
- Wesentliche Komponenten: `CameraCapture.jsx`, `ScanResults.jsx`, `ShareScanDialog.jsx`

7. Map 
- `src/pages/Map.jsx` - Interaktive Karte zum Anzeigen von allen persönlichen Scans, allen Scans in der unmittelbaren Umgebung und allen Scans zu einer bestimmten Pflanze. Funktioniert allerdings nur, wenn der User bei den Scans die Standortermittlung angeschaltet hat.








# Base44 Floralog (Developer Guide)

Short developer README to orient contributors and prepare the codebase for migration and backend handoff.

## What this project is
- Frontend SPA (React + Vite) for the Base44 Floralog app. UI built with small custom components and Tailwind.
- Uses a Base44 SDK (`src/api/base44Client`), `react-query` for data fetching and serverless functions in `functions/` for integrations.

## Quickstart (dev)
1. Install dependencies:

```bash
npm install
```

2. Start dev server:

```bash
npm run dev
```

3. Open `http://localhost:5173` (default Vite port).

## Important folders
- `src/pages` — top-level pages (Scanner, Home, Profile, etc.)
- `src/components` — UI building blocks and domain components
- `src/lib` — small shared utilities (e.g. `app-params.js`)
- `src/api` — SDK wrapper(s) to backend / Base44 client
- `functions` — serverless functions used by the frontend (see docs in `functions/`)

## ENV / App params
See `docs/APP_PARAMS.md` which explains `src/lib/app-params.js` and required runtime values.

## Immediate goals for making the code human-readable
- Add per-folder `README.md` files (we will add a few).
- Add barrels (`index.js`) for `src/components` and `src/components/ui` to standardize imports.
- Extract/organize large components into `hooks/` (logic) + `components/` (presentational) files.
- Add JSDoc/PropTypes for public components and document API contracts for serverless functions.

## Next steps I will do (if you confirm)
- Create `docs/APP_PARAMS.md` (done).
- Add barrels for `src/components` and `src/components/ui` (done).
- Add a `useScanner` hook skeleton and a plan to split `src/pages/Scanner.jsx` into smaller files.

If you want, I can now create issue-ready tasks or continue and apply the Scanner split skeleton into separate files; tell me which option you prefer.
# Base44 App
