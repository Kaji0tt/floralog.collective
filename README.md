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
- `Home` — central hub showing profile, quick-access areas, and the six core areas: `Collection`, `Achievements`, `Quests`, `Friends`, `Scanner`, `Map`.
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

## Guest-first funnel

Guests now enter Home Lite instead of the login landing page. The first visit
introduces Florabot and offers the free starter customization. The draft and a
versioned funnel state survive reloads in localStorage; photos and reward amounts
are never trusted from localStorage.

The first confirmed scan returns to Home Lite and plays the existing animated
scan feedback. Only its completion opens the dismissible email/Google account
dialog. Further scans require an account. Home Lite hides balances, plant health,
customization, badges, reward/KPI stripes and disables every bottom-nav action
except the camera. The event stripe previews the current weekly plant, monthly
quest and active community event, without querying personal participation.
The old download/help landing page remains available at `/guest-landing`.
On browsers supporting Web Locks, only one tab plays the pending reward animation.
Other tabs can resume it after that tab closes; completing it synchronizes the
account-required state without automatically opening another login dialog.

### Backend deployment

Deploy the backend **before** releasing this client:

1. Apply the [guest funnel migration](supabase/migrations/20261026114007_guest_first_scan_funnel.sql)
   to the target environment using the normal migration workflow.
2. Deploy `identifyPlant`, `checkPlantDistribution`, `robotPlantGrantReward` and
   the new `guestScan` function together. Shared server helpers are included with
   these functions. Existing user-only endpoints retain their auth checks;
   only server-to-server calls with the internal service secret bypass user auth.
3. Keep the standard `SUPABASE_SERVICE_ROLE_KEY` available to the Edge runtime:
   internal calls to JWT-verified endpoints use that legacy service JWT.
   The existing `SERVICE_ROLE_KEY` override is also supported for the admin client.
   Neither belongs in a frontend environment variable.
4. Configure a dedicated random `GUEST_SCAN_CLEANUP_SECRET` on the Edge Function.
   Configure the matching GitHub Actions secret, the repository variable
   `GUEST_SCAN_ENDPOINT` (the deployed `/functions/v1/guestScan` URL), and set
   `GUEST_SCAN_CLEANUP_ENABLED=true` after deployment. The
   [retention workflow](.github/workflows/guest-scan-cleanup.yml) then removes
   expired guest data hourly, up to 20 receipts per run. It uses the narrow cleanup
   secret, not a service-role key. New scan sessions also perform bounded cleanup.
5. Verify email confirmation and Google redirect allowlists for the web origin
   and the existing native `floralog://open` callback.

Guest defaults are intentionally bounded: **one successful scan per receipt,
four recognition attempts, five images per request, 8 MB per image, twenty
uploads per receipt, three starts per IP/day, 100 starts globally/day and 200
recognitions globally/day**. Request metadata rate keys contain salted hashes,
not raw IP addresses. Gateway-forwarded IP headers must be trustworthy in the
deployment; the global cap still applies independently of IP. Tune these values
in the function only after evaluating actual quota/cost data.

Unclaimed receipts and temporary private images expire after **seven days**.
Signed preview links last one hour. Confirmed images are copied to the public
`guest-discoveries` bucket during authenticated claim, matching the existing
public discovery-photo model. Claimed receipts retain only an account-linked
claim marker after temporary data cleanup, so one account cannot farm multiple
guest rewards. A local receipt reference does not automatically transfer across
devices or browsers.

The guest reward uses the shared server discovery/rarity formula with the first
scan multiplier, but no invented health, care, zone or owned-area bonuses.
Its exact reserved seed amount is credited once, in the same transaction as the
discovery and story-intro marker. Existing discovery triggers handle weekly and
community progress at claim time; achievement/monthly progress is refreshed
before entering authenticated Home. Guest previews do not grant streak currencies
or other account-only rewards. A personalized existing account avatar is never
overwritten by the guest draft.

### Focused verification

- State/storage tests: `node --test scripts\guest-funnel.test.mjs`.
- Reward formula tests: `deno test supabase\functions\guestScan\reward_test.ts`.
- Claim integration: run [test-guest-claim.sql](scripts/test-guest-claim.sql) with
  `psql -v ON_ERROR_STOP=1 -f scripts\test-guest-claim.sql` against an isolated,
  migrated test database. Test records are rolled back; do not use production.
- Browser integration: start Vite on `127.0.0.1:5317`, then run
  `node scripts\guest-funnel.browser.mjs` with Playwright and Edge available.
  An optional second argument is an installed Playwright module's `file:///`
  import URL, allowing session-local tooling without adding app dependencies.
  This test uses simulated camera input and mocked backend responses: it
  verifies onboarding, persistence, disabled navigation, failed-scan retries,
  scanner integration, cross-tab reward exclusivity and reward-before-login
  sequencing, not a live PlantNet/OAuth integration.
- Run the existing build, lint and typecheck commands. A real staging scan,
  email-confirmation flow and Google web/native round-trip remain deployment
  acceptance checks; local mocks cannot validate provider configuration.

The existing action analytics service is authenticated-only; it is deliberately
not opened to anonymous writes for this funnel. Guest receipts/server logs provide
scan-operation evidence without introducing a new anonymous tracking store.
