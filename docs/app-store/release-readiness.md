# EcoLearn iOS release readiness

Updated: September 4, 2026

## Current release state

- App Store Connect app: EcoLearn (`6806847380`)
- Bundle identifier: `com.ecolearn.mobile`
- Expo project: `@aarugunj/ecolearn-mobile`
- Public website: <https://ecolearn.dev>
- Previous submitted build: `1.0.0 (6)` from commit `1fc6e56`.
- Current release candidate: `1.0.0 (7)` from commit `9532d65`; EAS build
  `cf48f0e0-8a3b-4388-a775-5b62e5d37d9d` completed and its App Store upload
  was scheduled as EAS submission `a47cc6c6-0a9f-4f17-87e4-cf7a0ded3029`.
- App Review status: **Information Needed** under Guideline 2.1. Apple requested
  a physical-device recording plus six written disclosures. The complete reply
  and condensed App Review Notes are in
  `docs/app-store/guideline-2.1-information-response.md`.
- Release remains manual after approval. Pricing is free, availability is
  United States only, distribution is public and discoverable, and Apple
  Silicon Mac and Apple Vision Pro availability are disabled.
- Nine current screenshots are uploaded for both the 6.1-inch and Apple-required
  6.5-inch iPhone display sets.
- Content Rights declares that EcoLearn accesses third-party content and has the
  necessary rights or permission.
- Subtitle: `Learn. Scan. Act sustainably.`
- Primary category: Education; secondary category: Lifestyle.
- TestFlight description, feedback contact, marketing URL, privacy URL, and beta review notes are saved.
- Production branch: `main`
- iPhone-only first release; iPad support is intentionally disabled until tablet QA is complete.
- A dedicated, email-confirmed App Review account exists in production, has the
  effective `admin` role, and contains a private demonstration school with two
  classrooms, an assignment, an announcement, and an event. Keep its password
  in App Store Connect or a password manager, never in Git.

## Automated gates passed

- Expo Doctor: 21/21 checks on the build 7 dependency set
- TypeScript: pass
- iOS production JavaScript bundle: pass
- Android production JavaScript bundle: pass
- Root and platform-web production builds: pass
- Root and platform-web lint: zero errors (existing fast-refresh warnings only)
- Current local Playwright coverage: 36 passed, 4 credential-dependent scenarios skipped
- Authenticated production community integration: pass across admin, teacher,
  student, and unauthorized-user scenarios
- Production hub load check: 250/250 successful requests at 20 concurrent clients
- Production EAS environment: required Supabase public variables configured
- Privacy, Terms, support, and account-deletion URLs: HTTP 200 over HTTPS
- App Privacy responses: published in App Store Connect on August 31, 2026
- Native iOS privacy manifest: included in build 6 and aligned with the published responses
- Verified scan results can hand the exact official DNREC item to the map,
  prefill the material search, and automatically query nearby locations.
- Secure community/classroom migration: deployed and validated
- Server-enforced community content filtering, reporting, blocking, scoped
  moderation, soft removal, and RLS visibility controls: deployed and validated
- All 14 current local Edge Functions: deployed; `delete-account` is active
- Production scanner check: Pepsi can correctly resolves to the official
  `Aluminum cans` DNREC item

## Post-submission checks before manual release

- Install the newest TestFlight candidate on a physical iPhone.
- Test Apple, Google, and email sign-in; email confirmation; password reset; sign-out; and deletion.
- Test camera denial, gallery denial, location denial, weak network, and offline recovery.
- Verify visual scan, manual catalog autocomplete, barcode, label reading, nearby map, all six lessons, quests, achievements, profile editing, legal links, and account deletion.
- Monitor App Store Connect and the developer-contact inbox for reviewer
  questions, metadata issues, or a resolution-center message.
- Do not change the submitted build or version metadata while it is waiting for
  review unless responding to an Apple request.
- After approval, perform one final production smoke test before manually
  releasing version `1.0`.
- Resolve the under-13/classroom privacy model before describing EcoLearn as a child-directed classroom product.
- Do not claim 5,000-10,000-user readiness from the current Netlify tier. A
  high-concurrency production test triggered hosting protection; use staging,
  provider-approved distributed testing, monitoring, and a paid scaling plan.
- Remove the unused legacy `classify-delaware-scan` remote Edge Function after
  confirming no legacy client still calls it.

The classroom/community system is implemented and its production authorization
boundaries pass integration testing. Under-13 promotion or school deployment
remains blocked on the youth/privacy and school-authorization decision.
