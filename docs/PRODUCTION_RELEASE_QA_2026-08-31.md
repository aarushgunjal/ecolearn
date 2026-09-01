# EcoLearn production release QA

**Date:** August 31, 2026

**Production branch:** `main`

**Web:** <https://ecolearn.dev>
**iOS candidate:** `1.0.0 (5)`, commit `566baa8`

## Release conclusion

The website is live and the current iOS candidate is available in App Store
Connect/TestFlight. App Privacy responses are published and build 5 includes the
matching native privacy manifest. The production community/classroom schema and all current
local Edge Functions are deployed. Automated web, backend, build, and security
checks pass, with the limitations listed below.

This is not yet permission to press **Submit for Review**. A physical-iPhone
acceptance pass, store metadata/screenshots, App Privacy and age-rating answers,
and the youth/privacy positioning decision remain mandatory.

## Functional checks completed

- Production web Playwright: **34 passed, 2 intentionally skipped, 0 failed**
  across desktop Chromium and Pixel 7 responsive emulation.
- Dedicated App Review account: email/password login, `admin` role, community,
  school, two classrooms, assignment, announcement, event, school standings,
  Admin portal, and Admin review access all verified.
- Community integration: admin, teacher, student, and outsider accounts tested
  against production. Private teacher promotion, student self-promotion denial,
  multiple communities, multiple classrooms, private join codes, assignments,
  announcements, events, RSVP, teacher alias-only analytics, aggregate class
  standings, and cross-role denial checks all passed. Temporary QA users and
  communities were removed after the test.
- Scanner: a Pepsi can photo produced `Pepsi can` as the observed object and
  correctly queried/matched the official DNREC `Aluminum cans` record.
- Catalog search: official exact match and five predictive suggestions returned.
- Barcode: Open Food Facts lookup returned Coca-Cola for a known test barcode.
- Label reader: aluminum material detection returned from the supplied can photo.
- Map: electronics lookup near Wilmington returned 11 source-linked locations.
- Unauthorized guidance request returned 401; malformed location input returned 400.
- Privacy, Terms, Support, and account-deletion routes return over HTTPS.

## Build and dependency checks

- Platform web lint: pass.
- Platform web production build: pass. The main bundle remains above Vite's
  500 KB advisory threshold and should be code-split before significant scale.
- Web dependency audit: zero vulnerabilities.
- Expo Doctor: 21/21 checks pass.
- Mobile TypeScript: pass.
- iOS Hermes production export: pass.
- Android Hermes production export: pass.
- Mobile production dependency audit: no high or critical findings. Eleven
  moderate `uuid` advisories remain in Expo/Xcode build-tool dependencies. npm's
  force fix would make a breaking Expo change and was not applied.
- Tracked-secret scan: no private key, service-role token, OpenRouter key, or
  comparable secret pattern found. Local `.env` files are ignored.
- Production response headers include CSP, HSTS, frame denial, MIME-sniffing
  denial, strict referrer policy, and camera/geolocation permissions policy.

## Load checks

- Authenticated community hub: 250/250 successful requests, concurrency 20,
  168.69 requests/second, p50 67.03 ms, p95 561.72 ms, p99 594.32 ms.
- A larger single-origin static-site test triggered Netlify protection. The home
  run completed 1,408/3,000 requests before 403 responses/timeouts; the map run
  completed 929/2,000 before the same protection. The site recovered and returned
  HTTP 200 with its security headers afterward.

This result is not evidence of an application crash. It is evidence that
single-origin burst testing is throttled by the current hosting protection and
that 5,000-10,000-user capacity must be validated on staging with Netlify's
approval, distributed load generators, paid quotas, and monitoring.

## Remaining manual release gates

1. Install build 4 from TestFlight on a physical iPhone.
2. Test Apple, Google, and email sign-in; password reset; sign-out; and account
   deletion with disposable accounts.
3. Test camera, gallery, and location grant/deny/re-enable behavior.
4. Verify the native map, markers, recentering, and external directions handoff.
5. Repeat scanner, barcode, label, lessons, XP, community, and offline/weak-network
   journeys after force-closing and reopening the app.
6. Capture final App Store screenshots from the accepted physical-device build.
7. Complete age rating, content rights, pricing/availability, build selection,
   reviewer credentials, and screenshots. App Privacy, review contact, reviewer
   notes, and the manual-release preference are already complete.
8. Resolve whether the public launch is general-audience education or an
   authorized child-directed/school deployment before marketing classroom use.
9. Confirm that no legacy client uses the remote-only `classify-delaware-scan`
   function, then delete that obsolete deployment to reduce attack surface.

No iOS simulator, Android emulator, ADB-connected device, or physical device was
available to this workstation during the audit. Native compilation is verified;
hardware behavior must still be accepted on real devices.
