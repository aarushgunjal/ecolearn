# EcoLearn comprehensive QA, security, and stress audit

**Audit date:** August 20, 2026  
**Active applications:** `apps/platform-web` and `apps/mobile-ecolearn`  
**Backend:** `apps/platform-web/supabase`  
**Status:** Code-level and automated checks pass. The privacy migration and
updated Edge Functions still need to be deployed, and native hardware behavior
still needs a short physical-device pass before a school pilot.

## Outcome

The nearby-location feature is no longer a placeholder. The web application now
shows an interactive Leaflet map and the Expo application uses a native map. A
single location lookup combines:

- official DSWA facilities with verified coordinates and service categories;
- item-specific DNREC Recyclopedia organizations and related solution tags;
- a bounded OpenStreetMap/Overpass fallback for additional nearby results.

Users can see every returned marker, select a result from the map or list, open
directions, inspect services, and follow the original official source. Generic
searches now cover everyday recycling, batteries, electronics, household
hazardous waste, yard waste, and textiles. Specific scanner matches follow the
DNREC relationship category, so an item such as a can opener can correctly lead
to electronics locations.

The Scanner Tools page previously simulated barcode and label actions. It now
uses the real shared scanner utilities, including the real nearby-location map.
The Supabase deployment workflow also now discovers and deploys every function
with an `index.ts`, rather than silently leaving eight functions stale.

## Automated functional coverage

| Surface | Result | Coverage |
| --- | --- | --- |
| Web lint | Pass | Entire active web source |
| Web production build | Pass | Vite 8 production output and Netlify public files |
| Desktop browser | 16 pass | Chromium guest journeys, scanner/search, category-selected DSWA video, map, auth validation, lessons, hubs, persistence, privacy, terms, account deletion |
| Mobile web | 14 pass, 2 intentional skips | Pixel 7 emulation of the same responsive journeys |
| Expo TypeScript | Pass | Entire native application |
| Expo SDK compatibility | Pass | SDK 57 dependencies reported up to date |
| Android production bundle | Pass | Hermes bundle, 2.3 MB |
| iOS production bundle | Pass | Hermes bundle, 2.3 MB |
| Supabase type-check | Pass | All 14 function entrypoints plus shared imports (15 files) |
| Supabase lint | Pass | Entire functions directory |
| Map service integration | Pass | Real DNREC/DSWA/OSM requests plus input-abuse cases |

The two browser skips are deliberate desktop-menu tests that do not apply to the
compact mobile navigation. The aggregate Playwright result is **30 passed, 2
skipped, 0 failed**.

The browser suite verifies:

- all primary and extended navigation sections render;
- gallery and camera are separate inputs;
- scanner URLs restore state safely and script-like input is not executed;
- official predictive item suggestions appear;
- a verified electronics category selects DSWA's electronics video rather than
  matching on a product brand;
- invalid registration is blocked;
- lessons require the correct answer;
- map results render as individual interactive markers;
- directions and official-source actions are available;
- denied geolocation does not make a location request;
- community, organization, notification, challenge, and local-rule state persists;
- guests cannot claim account XP;
- privacy, terms, and account-deletion routes are directly reachable.

## Location service verification

The Edge Function was run locally against the real external data services near
Wilmington, Delaware:

| Request | Result | Observed response |
| --- | --- | --- |
| `electronics` | 200 | 11 sites; DSWA, DNREC, and OSM sources |
| `recycling` | 200 | 24 sites; mixed official and supplemental sources |
| `Can opener` | 200 | 5 sites; matched DNREC category `Electronics` |
| Coordinates supplied as strings | 400 | Rejected |
| Coordinates outside the Mid-Atlantic boundary | 400 | Rejected |
| Unsupported/injection-like type | 400 | Rejected |
| GET instead of POST | 405 | Rejected |

Requests have a 4 KB body ceiling, an allowlisted category vocabulary, numeric
coordinate checks, a regional bounding box, upstream timeouts, and private cache
headers. These controls prevent the function from becoming a general-purpose
public Overpass proxy.

## Stress-test results

A reusable load harness is stored at `scripts/stress-test.mjs`. Tests were
bounded so the audit would not abuse public DNREC or OpenStreetMap infrastructure.

| Target | Requests / concurrency | Failures | Throughput | p95 latency |
| --- | ---: | ---: | ---: | ---: |
| Production-built home route | 1,000 / 50 | 0 | 764.73 req/s | 138.19 ms |
| Production-built scanner route | 500 / 30 | 0 | 413.98 req/s | 129.01 ms |
| Production-built scanner-tools route | 500 / 30 | 0 | 406.36 req/s | 139.80 ms |
| Location validation/rejection path | 500 / 50 | 0 transport failures | 1,804.19 req/s | 53.93 ms |
| Real item-location lookup | 20 / 4 | 0 | 11.00 req/s | 542.87 ms |

This is a strong local concurrency and regression result, but it is not evidence
that a free Supabase/OpenRouter/Netlify stack can sustain 5,000-10,000 simultaneous
users. Before that scale, run a distributed k6 test against a staging environment
with provider approval, funded quotas, production monitoring, and no shared public
Overpass endpoint in the hot path.

## Security findings and fixes

### Fixed in this change

- Added Netlify security headers: CSP, HSTS, frame denial, MIME sniffing denial,
  strict referrer policy, camera/geolocation permissions, and opener isolation.
- Added a restrictive deferred-classroom migration. The initial schema allowed
  public browser reads of classrooms, assignments, events, and discoverable
  groups, including classroom join codes. The new migration removes those
  policies and revokes direct browser access until DSWA approves the under-13
  data and teacher-access model.
- Confirmed AI functions authenticate the caller. The primary visual scanner also
  has per-user hourly and global daily request limits and fails closed when the
  secure usage-log migration is unavailable.
- Confirmed progress/XP mutations use security-definer functions with server-side
  validation, official item records, idempotency, and daily scan limits.
- Confirmed no tracked OpenRouter, GitHub, AWS, service-role, or private-key secret
  was found by the repository scan.
- Fixed a nullable-row type defect in the scheduled DNREC sync function.
- Web production and full dependency audits now report **0 vulnerabilities**.

### Open risks

1. **Apply the new SQL migration before classroom work or a school pilot.** The
   function-only GitHub workflow does not apply migrations. Run
   `202608200001_deferred_classroom_privacy.sql` through the Supabase SQL Editor or
   a reviewed migration deployment.
2. **Expo build-tool advisories remain.** npm reports 16 transitive advisories
   (8 moderate, 8 high) through Metro `image-size` and Xcode tooling `uuid`.
   npm's proposed force fix downgrades Expo to SDK 53 and is incompatible with
   the required SDK 57. Do not use it. Monitor Expo 57 patches and retest.
3. **AI tools beyond the primary scanner need a shared atomic quota.** Label
   reading and general guidance authenticate users, but they do not share the
   scanner's database-backed global allowance. Put every billable OpenRouter call
   behind one atomic quota before public growth, and keep a provider-side hard cap.
4. **GitHub Actions are not fully pinned.** Checkout/setup actions use version
   tags and the Supabase CLI uses `latest`. Pin commit SHAs and a tested CLI version
   for stronger supply-chain integrity and reproducible deployments.
5. **Public map infrastructure has no SLA.** The public OSM tile and Overpass
   services are suitable only for development/light use. Set `VITE_MAP_TILE_URL`
   and `VITE_MAP_ATTRIBUTION` to an approved funded provider before scale, and
   replace or cache the Overpass fallback.
6. **The web JavaScript bundle is 667.69 KB minified.** It works, but exceeds the
   500 KB warning. Lazy-load Leaflet, admin screens, and extended hubs before a
   larger pilot.
7. **The repository still contains a legacy root web application.** The active
   deploy target is `apps/platform-web`; the root app creates deployment ambiguity
   and retains a public Supabase anon token. The canonical public domain is
   `ecolearn.dev`.
   An anon key is not a private secret, but the unused app should be archived in a
   separate, explicitly approved cleanup.
8. **Static DSWA facility data needs maintenance.** Verify addresses, services,
   and source links on a schedule and update them when DSWA changes a facility.

## What could not be truthfully automated here

There was no connected iPhone, Android phone, iOS simulator, Android emulator,
ADB, or Java/Android toolchain in this workspace. Native bundles and types pass,
but these hardware-dependent checks remain mandatory in Expo Go on at least one
iOS and one Android device:

1. sign in and sign out with a staging account;
2. choose a gallery photo and take a camera photo;
3. grant, deny, then re-enable location permission;
4. verify native map rendering, all markers, selection, and map recentering;
5. open directions into the platform maps application;
6. scan an item, run exact-name search, barcode lookup, and label reading;
7. complete a lesson and verify XP/streak persistence after restart;
8. test offline and poor-network error states;
9. open privacy, terms, support, and account-deletion flows;
10. verify the white-background app icon and launch screen on both platforms.

Production OAuth, email delivery, paid LLM billing, and actual account deletion
were also not mutated during this audit. Run them with a dedicated staging user
after the functions and migration are deployed.

## Deployment order

1. Review and commit these changes on the intended branch.
2. Apply `apps/platform-web/supabase/migrations/202608200001_deferred_classroom_privacy.sql`.
3. Run **Deploy EcoLearn Supabase functions** with that same branch as
   `source_ref`; the workflow now deploys all current function entrypoints.
4. Redeploy `apps/platform-web` to Netlify so the SPA map and `_headers` go live.
5. Run the physical-device checklist through Expo Go.
6. Repeat a small production smoke test, then monitor function errors, map latency,
   AI quota use, and hosting usage.
