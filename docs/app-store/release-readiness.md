# EcoLearn iOS release readiness

Updated: August 31, 2026

## Current release state

- App Store Connect app: EcoLearn (`6806847380`)
- Bundle identifier: `com.ecolearn.mobile`
- Expo project: `@aarugunj/ecolearn-mobile`
- Public website: <https://ecolearn.dev>
- TestFlight release candidate: `1.0.0 (5)` from commit `566baa8`
- Production branch: `main`
- iPhone-only first release; iPad support is intentionally disabled until tablet QA is complete.
- A dedicated, email-confirmed App Review account exists in production, has the
  effective `admin` role, and contains a private demonstration school with two
  classrooms, an assignment, an announcement, and an event. Keep its password
  in App Store Connect or a password manager, never in Git.

## Automated gates passed

- Expo Doctor: 21/21 checks
- TypeScript: pass
- iOS production JavaScript bundle: pass
- Android production JavaScript bundle: pass
- Root and platform-web production builds: pass
- Root and platform-web lint: zero errors (existing fast-refresh warnings only)
- Local and production Playwright coverage includes 34 passed, 2 intentionally skipped
- Authenticated production community integration: pass across admin, teacher,
  student, and unauthorized-user scenarios
- Production hub load check: 250/250 successful requests at 20 concurrent clients
- Production EAS environment: required Supabase public variables configured
- Privacy, Terms, support, and account-deletion URLs: HTTP 200 over HTTPS
- App Privacy responses: published in App Store Connect on August 31, 2026
- Native iOS privacy manifest: included in build 5 and aligned with the published responses
- Secure community/classroom migration: deployed and validated
- All 14 current local Edge Functions: deployed; `delete-account` is active
- Production scanner check: Pepsi can correctly resolves to the official
  `Aluminum cans` DNREC item

## Manual gates before App Review

- Install the newest TestFlight candidate on a physical iPhone.
- Test Apple, Google, and email sign-in; email confirmation; password reset; sign-out; and deletion.
- Test camera denial, gallery denial, location denial, weak network, and offline recovery.
- Verify visual scan, manual catalog autocomplete, barcode, label reading, nearby map, all six lessons, quests, achievements, profile editing, legal links, and account deletion.
- Capture current iPhone screenshots only after the candidate passes.
- Complete age rating, pricing and availability, content-rights, and reviewer-credential fields.
- Resolve the under-13/classroom privacy model before describing EcoLearn as a child-directed classroom product.
- Do not claim 5,000-10,000-user readiness from the current Netlify tier. A
  high-concurrency production test triggered hosting protection; use staging,
  provider-approved distributed testing, monitoring, and a paid scaling plan.
- Remove the unused legacy `classify-delaware-scan` remote Edge Function after
  confirming no legacy client still calls it.

The classroom/community system is implemented and its production authorization
boundaries pass integration testing. Under-13 promotion or school deployment
remains blocked on the youth/privacy and school-authorization decision.
