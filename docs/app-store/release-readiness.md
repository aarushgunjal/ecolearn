# EcoLearn iOS release readiness

Updated: August 30, 2026

## Current release state

- App Store Connect app: EcoLearn (`6806847380`)
- Bundle identifier: `com.ecolearn.mobile`
- Expo project: `@aarugunj/ecolearn-mobile`
- Public website: <https://ecolearn.dev>
- Existing TestFlight upload: `1.0.0 (2)`
- Release branch: `codex/app-store-readiness`
- iPhone-only first release; iPad support is intentionally disabled until tablet QA is complete.

## Automated gates passed

- Expo Doctor: 21/21 checks
- TypeScript: pass
- iOS production JavaScript bundle: pass
- Android production JavaScript bundle: pass
- Root and platform-web production builds: pass
- Root and platform-web lint: zero errors (existing fast-refresh warnings only)
- Platform-web Playwright suite: 32 passed, 2 intentionally skipped
- Production EAS environment: required Supabase public variables configured
- Privacy, Terms, support, and account-deletion URLs: HTTP 200 over HTTPS

## Manual gates before App Review

- Install the newest TestFlight candidate on a physical iPhone.
- Test Apple, Google, and email sign-in; email confirmation; password reset; sign-out; and deletion.
- Test camera denial, gallery denial, location denial, weak network, and offline recovery.
- Verify visual scan, manual catalog autocomplete, barcode, label reading, nearby map, all six lessons, quests, achievements, profile editing, legal links, and account deletion.
- Capture current iPhone screenshots only after the candidate passes.
- Complete App Privacy, age rating, pricing and availability, review contact, and reviewer notes.
- Resolve the under-13/classroom privacy model before describing EcoLearn as a child-directed classroom product.

The classroom/teacher system remains intentionally deferred until DSWA guidance is received. It is not represented as part of version 1.0.
