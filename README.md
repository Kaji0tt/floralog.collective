# Floralog

Floralog is a React + Vite single-page app for exploratory plant discovery and personal collections. Built with Tailwind CSS and small, composable UI components, it pairs a client-side interface with lightweight serverless functions for integrations (identification, payments, notifications).

## Project structure (concise):
- `src/pages` — top-level routes and page logic.
- `src/components` — feature components and `ui/` primitives.
- `src/lib`, `src/hooks` — shared utilities and custom hooks (logic separated from presentation).
- `src/api` — frontend SDK wrappers and API clients.
- `functions/` — serverless integration functions used by the frontend.
- `docs/` — documentation and runtime parameter specs (see [docs/APP_PARAMS.md](docs/APP_PARAMS.md)).

## Core pages (entry points in `src/pages`):
- `Home` — central hub showing profile, quick-access tiles, and the six core areas: `Collection`, `Achievements`, `Quests`, `Friends`, `Scanner`, `Map`.
- `Collection` — personal catalogue combining global indices with user photos. Also see `src/components/collection`
- `Achievements` — personal progress and task lists. Also see `src/components/quests`
- `Quests` / `Community` — shared/weekly quests and planned team/room features, statistics.
- `Friends` — friends list, activity feed, and shared/exchanged scans.
- `Scanner` — external identification API (Pl@ntNet); presents candidate matches when confidence > 5% in scanResults. See `src/components/scanner`.
- `Map` — interactive view of personal and nearby scans (requires location enabled).

## Home Layout Structure:
Konkrete Benennung für das Home-Layout:

1. home-page-shell
Das komplette sichtbare Home-Viewport-Gerüst.
2. home-profile-card
Deine „Profil Kachel“ (äußerster gerahmter Bereich mit Name, Hero, Seeds, Scan, Nav).
3. home-header-bar
Name/Titel + Settings oben.
3. home-content-stack
Der innere Hauptbereich zwischen Header und Bottom-Navigation.
4. 1. home-plant-hero-section
Der Block mit Zone/Health, Plant-Hero/Stats, Seeds, Scan.
4. 2. home-plant-health-status-subcontainer
Der Block unterhalb Zone/Healh, der angezeigt wird um die Pflanzendaten anzuzeigen.
5. home-plant-hero-stage
Nur die große quadratische Hero-Fläche (wo Pflanze oder Stats angezeigt werden).
6. home-bottom-nav
Die 4 Buttons unten.
7. home-footer-links
Spenden/Impressum/News.

## Architecture update (Single Source Richtung)

- Home ist der visuelle Host und besitzt Hintergrund/Shell über `HomeBackgroundShell`.
- Die Header-Logik ist als wiederverwendbare Komponente `HomeHeaderBar` extrahiert.
- `Collection` ist als Route-Datei nur noch ein dünner Wrapper (`src/pages/Collection.jsx`).
- Die eigentliche Collection-Feature-Implementierung lebt in `src/components/collection/CollectionFeatureRoot.jsx`.
- Teilbereiche sind weiter aufgeteilt in:
	- `CollectionScreen` (Hauptansicht)
	- `PublicCollectionScreen` (öffentliche/User-Kollektionen)
	- `useCollectionViewState` (Filter-, Auswahl- und Scroll-ViewState)

Damit gibt es eine zentrale fachliche Quelle für die Collection-Logik, während Route und Home nur noch orchestrieren.

## Additional pages (high-level grouping)

- **Friends / Social**
	- `FriendProfile` — central view for a single friend (public profile, recent activity, stats).
	- `FriendFriendsList` — the friend's list of connections.
	- `FriendCollection` — the friend's shared collection and gifted scans.
	- `FriendAchievements` — achievements and progress visible for that friend.

- **Admin**
	- `AdminQuestCreator` — create and manage quests and quest schedules.
	- `AdminPlantNames` — edit canonical plant names and localized labels.
	- `AdminPlantImporter` — bulk import plant/genus data (CSV/JSON import flows).
	- `AdminFixDuplicateGenusNumbers` — tools to detect and repair duplicate genus numbering.
	- `NewsAdmin` — manage news posts and announcements.

- **Other important pages**
	- `Privacy` / `Datenschutz` — legal privacy notice and data handling details.
	- `Feedback` — user feedback form and bug reporting.
	- `Donate` — donation flow and payment info. Uses PayPal API
	- `Impressum` — legal imprint / publisher information.

Remaining pages in `src/pages` are mostly utility, migration, or debug helpers (e.g., import/migration tools, debug views). These are lower-priority "leftovers" but can be documented individually on request.

## Backend entities
- Persistent entities and authoritative schemas live server-side and are not included in this frontend repo. 
To add them here, export API schemas (OpenAPI / JSON Schema) or example responses; 
- will be possible from 13.02 onwards
