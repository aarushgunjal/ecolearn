# EcoLearn production QA report

Date: 2026-08-29
Branch tested: `codex/app-store-readiness`
Canonical repository: `aarushgunjal/ecolearn`

## Release conclusion

No known release-blocking source defect remains in the automated and guest-accessible scope tested below. The production web app, both Expo packages, all Supabase Edge Functions, public routes, map lookup, security headers, and the regression suite passed their release gates after the fixes documented here.

The remaining checks are release operations that cannot be truthfully completed without a dedicated test account, physical iOS/Android devices, Apple/Google signing access, and a deployment of this branch. They are listed separately under **External release gates** and are not hidden as passes.

## Evidence summary

| Area | Result | Evidence |
| --- | --- | --- |
| Production web lint | Pass | 0 errors |
| Production web build | Pass | Vite production build completed |
| Web regression suite | Pass | 32 passed across desktop and Pixel 7 profiles; 2 intentional desktop-only skips on the mobile project |
| Public route coverage | Pass | 17 local routes opened with the correct title and heading; no browser console errors |
| Responsive layout | Pass | Desktop and 390×844 scanner/tools inspections; mobile document width matched viewport with no horizontal overflow |
| Local accessibility/SEO | Pass | Lighthouse accessibility 100, best practices 100, SEO 100 after fixes |
| Live website | Pass | `https://ecolearn.dev`, deep links, HTTPS, and `app.ecolearn.dev` → `ecolearn.dev` redirect verified |
| Live security headers | Pass | CSP, HSTS, frame denial, MIME sniffing protection, referrer policy, and permissions policy present |
| Live map backend | Pass | Public Delaware test coordinate returned HTTP 200 and 17 nearby sites; closest result provider was DNREC |
| Function authorization | Pass | DNREC search, vision scan, label reader, account deletion, and generated guidance rejected anonymous requests with HTTP 401 |
| Edge Function type check | Pass | Deno checked all 14 function entrypoints plus shared DNREC code |
| Database migration structure | Pass | 13 migrations, no duplicate version prefixes |
| Edge deployment coverage | Pass | 14 function directories, 0 missing `index.ts` entrypoints; workflow deploys discovered functions dynamically |
| Full mobile app health | Pass | Expo Doctor 21/21 and TypeScript passed |
| Full mobile bundles | Pass | iOS Hermes bundle (702 modules, 2.3 MB) and Android Hermes bundle (700 modules, 2.4 MB) exported |
| Standalone scanner health | Pass | Expo Doctor 21/21 and TypeScript passed |
| Standalone scanner bundles | Pass | iOS Hermes bundle (645 modules, 2.1 MB) and Android Hermes bundle (643 modules, 2.1 MB) exported |
| Local web load test | Pass | 21,000 requests in 15.04 seconds; 1,390 requests/second average; p50 141 ms, p99 193 ms, max 223 ms; no reported request failures |
| Web/root production dependencies | Pass | npm reported 0 vulnerabilities |
| Tracked secret scan | Pass | No private key or credential value found; only environment-variable names and documentation examples matched |

## Feature coverage

The desktop/mobile browser suite covered:

- Home, shareable routes, primary navigation, compact mobile navigation, and the extended tools menu.
- Scanner empty state, safe input handling, predictive DNREC suggestions, gallery/camera separation, verified electronics matching, and the relevant DSWA electronics video.
- Lessons, required quiz selection, completion controls, and navigation from the home lesson card.
- Challenges, guest persistence, and prevention of unauthenticated XP claims.
- Leaderboard, community actions, organization actions, notifications, municipality rules, and official DNREC links.
- Barcode validation, label-consent state, nearby-location category selection, interactive map markers, directions links, and denied-location handling.
- Guest/admin access boundaries, registration validation, profile sign-in prompt, privacy, terms, support, and account-deletion instructions.

The mobile source/build pass covered email authentication, password recovery deep links, Apple authentication configuration, Google OAuth handoff configuration, scanner upload/camera flows, DNREC results, lessons, XP/progress reads, challenges, ranks, profile preferences, barcode lookup, label reading, nearby maps, support/legal links, and account deletion at compile/configuration level.

## Defects fixed during QA

- Removed the remaining unsafe mobile tool-response `any` values and normalized barcode/label function payloads before rendering.
- Prevented duplicate Apple sign-in requests and corrected mobile refresh/profile hook dependencies.
- Updated and deduplicated the standalone Expo package so Expo Doctor passes all checks.
- Cleared the legacy root package's high-severity dependency advisories by upgrading React Router and Vite; removed the incompatible development-only tagger.
- Replaced legacy explicit `any` values with database-backed types, fixed nullable progress arithmetic, corrected hook dependencies, and made the repository lint gate pass.
- Changed the legacy build output from `docs` to `dist`, preventing a build from deleting repository QA documentation.
- Added an accessible name to the sign-in dialog close control and a regression assertion.
- Fixed low-contrast homepage/footer/mobile-navigation text and removed opacity-based locked states that failed accessibility contrast checks.
- Made the home lesson card perform its expected navigation and added a desktop/mobile regression test.
- Added a search description, valid `robots.txt`, and a sitemap; local Lighthouse accessibility, best-practice, and SEO scores are now 100.

## Security and dependency notes

The active web app and legacy root package report zero npm vulnerabilities. The Expo dependency trees report no high or critical vulnerabilities, but npm lists 11 moderate findings in the full app and 10 in the standalone scanner. They all trace to Expo build tooling's `xcode` → `uuid` dependency. npm's proposed forced resolution would downgrade Expo from SDK 57 to SDK 46, so it was intentionally rejected as an unsafe and incorrect release fix. Expo Doctor still passes 21/21 for both projects.

The live site returned HTTP 200 over HTTPS with the expected restrictive headers. Anonymous calls to paid or sensitive functions returned HTTP 401. The location endpoint accepts public Delaware-area coordinates by design, constrains its coordinate region and payload size, and returned current DSWA/DNREC/OpenStreetMap-backed results during the smoke test.

## Performance notes

The current deployed homepage scored 84 performance, 96 accessibility, 100 best practices, and 82 SEO in Lighthouse. The accessibility and SEO findings were fixed locally, reaching 100/100/100 for accessibility/best-practices/SEO. The corrected scores will become production evidence only after this branch is deployed.

The production web bundle is approximately 670 KB minified / 193 KB gzip and triggers Vite's 500 KB advisory. It is not a release failure, but route/component code splitting should be the next performance optimization before larger school-wide traffic.

## External release gates

These require accounts, hardware, or deployment access not available to this QA run:

1. Deploy this branch through Netlify, then rerun production Lighthouse and confirm `robots.txt`, `sitemap.xml`, `/support`, and the contrast fixes on `ecolearn.dev`.
2. Use a dedicated staging user to complete real email verification, Google OAuth, Apple sign-in, password recovery, signed-in DNREC search, one real vision scan, one label read, progress/XP persistence, profile save, and account deletion. This should be done with a capped staging AI budget.
3. Install an EAS development or TestFlight build on at least one current iPhone and one current Android device. Verify camera, gallery, location permission allow/deny paths, maps, deep links, keyboard behavior, safe areas, offline/reconnect behavior, and screen-reader labels.
4. Produce signed iOS and Android release builds only after Apple Developer and Google Play credentials are ready, then complete store metadata, privacy disclosures, screenshots, and review notes.

## Release recommendation

The branch is ready to commit and deploy for the web fixes and ready for signed mobile build preparation. Do not describe the app as fully store-validated until the four external gates above are complete.
