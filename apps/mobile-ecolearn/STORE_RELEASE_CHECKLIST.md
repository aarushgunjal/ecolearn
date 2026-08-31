# EcoLearn mobile store-release checklist

This is the active handoff document for the first App Store and Google Play
release. Apple signing is configured and the first TestFlight build has been
uploaded; the current release candidate still needs real-device acceptance QA
before it is sent to App Review.

## Draft listing

- **App name:** EcoLearn
- **Apple subtitle:** Learn. Scan. Act sustainably.
- **Google short description:** Learn sustainable habits and check items against Delaware disposal guidance.
- **Primary category:** Education
- **Suggested secondary category:** Lifestyle
- **Support email:** aarushgunjal1@gmail.com
- **Privacy URL:** https://ecolearn.dev/privacy
- **Terms URL:** https://ecolearn.dev/terms
- **Account-deletion URL:** https://ecolearn.dev/delete-account
- **Support URL:** https://ecolearn.dev/support

### Full description draft

EcoLearn turns everyday sustainability choices into practical learning.

Build your environmental knowledge through short lessons, challenges, streaks,
and progress tracking. When you are unsure about an item, take or choose a
photo. EcoLearn identifies the visible item and checks it against mirrored
Delaware DNREC Recyclopedia guidance. If there is no reliable official match,
EcoLearn says so instead of inventing a disposal rule.

Features include:

- Camera and gallery item scanning
- Verified Delaware disposal guidance when an official match is available
- Package-label and barcode tools
- Nearby disposal-site lookup with permission
- Multiple classrooms, schools, and local communities per account
- Teacher assignments, private class analytics, announcements, events, and aggregate school standings
- Sustainability lessons, quizzes, XP, streaks, and challenges
- In-app account deletion

EcoLearn is an independent educational product. It is not an official DNREC,
DSWA, State of Delaware, or local-government application. Always confirm
hazardous, medical, battery, electronics, chemical, and other special-waste
requirements with the responsible local program.

### Suggested keywords

recycling, sustainability, environment, Delaware, waste, disposal, education,
DNREC, eco, learning

## Product and technical preparation

- [x] Expo SDK 57 / React Native 0.86 project validates.
- [x] Expo Doctor passes all 21 checks and iOS/Android production bundles compile.
- [x] Stable iOS bundle ID and Android package are set to `com.ecolearn.mobile`.
- [x] EAS remotely manages and auto-increments the iOS build number and Android version code.
- [x] Production, preview APK, development-client, and iOS Simulator EAS profiles exist.
- [x] Camera, photo-library, location, and blocked-audio permissions are declared.
- [x] White-background EcoLearn artwork is used for the icon and splash screen.
- [x] iOS non-exempt encryption is declared false for the current implementation.
- [x] Privacy Policy and Terms links are available during account creation and in Profile.
- [x] Native Sign in with Apple is implemented and configured in the Expo project.
- [x] Password recovery returns through the EcoLearn deep-link scheme.
- [x] Public support route and in-app support link are implemented.
- [x] In-app account deletion has two confirmations.
- [x] A public account-deletion route is implemented for the website.
- [x] Apple bundle identifier, distribution certificate, provisioning profile, EAS project, and App Store Connect app are configured.
- [x] App Store Connect received TestFlight build `1.0.0 (4)` from commit `d78a56c`.
- [x] Deploy and validate the secure community/classroom migration.
- [x] Upload a new TestFlight candidate containing the community and primary-map navigation.
- [x] Production EAS environment contains both required public Supabase variables.
- [x] Privacy, Terms, deletion, and support URLs return successfully over HTTPS.
- [x] Deploy the `delete-account` Supabase Edge Function.
- [ ] Add `ecolearn-mobile://auth/callback` and `ecolearn-mobile://auth/reset-password` to Supabase Auth redirect URLs.
- [ ] Test Apple, Google, email/password, reset, and deletion on a physical iPhone using the current release candidate.
- [x] Validate the dedicated App Review admin account and its private school/classroom demo data on production web.
- [ ] Capture store screenshots from final real-device builds.
- [ ] Complete App Privacy, age rating, pricing/availability, reviewer contact, and review notes in App Store Connect.

The maintained App Store package now lives in `../../docs/app-store/`. Use those
files for release status, listing copy, privacy answers, reviewer notes,
screenshots, and TestFlight QA.

## Data-practice inventory for store forms

Treat this as a draft to verify against the production configuration at the
time of submission; it is not a completed legal or store declaration.

| Data or access | Why EcoLearn uses it | Expected handling |
| --- | --- | --- |
| Email and optional profile name | Authentication, account, and support | Stored in Supabase while the account is active |
| App activity | Progress, XP, lessons, scans, settings, and abuse prevention | Stored in Supabase and associated with the account |
| Camera/photo-library images | User-requested item or label analysis | Sent for the requested analysis; not stored by the scanner itself |
| Precise device location | User-requested nearby disposal search | Requested only when the user starts the search; coordinates are sent to the lookup function |
| Authentication identifiers | Session management and account security | Processed by Supabase; Google data is involved only for optional Google sign-in |
| Barcode or visible label text | Product and material lookup | Sent only when the user invokes the applicable tool |

Production subprocessors and external requests currently include Supabase,
the configured OpenRouter vision provider, optional Google sign-in, Delaware
DNREC data/services, Open Food Facts for barcode lookups, and map/search data
services used by the nearby-results flow. Re-audit the deployed function code
and provider settings immediately before answering Apple App Privacy and Google
Play Data safety questions.

## Store form draft decisions to verify

- The app creates accounts, so both stores need a working deletion path.
- Camera, photos, and location are optional feature permissions, not required at launch.
- User-selected images are sent off-device for requested AI analysis.
- Scanner and label-reader images are processed only for the requested result;
  the current app does not offer a training-photo submission flow.
- The app should not be described as tracking users across third-party apps or websites unless the production SDK/provider audit shows otherwise.
- The app contains no advertising SDK in the current source tree.
- Store age-rating answers must match the final content and account model.

## Release gates requiring a decision

- [ ] **Youth/privacy model:** the current Privacy Policy says EcoLearn is not
  directed to children under 13, while the broader product includes school and
  primary-education ideas. Resolve the intended audience, parent/teacher consent,
  classroom ownership, and DSWA role before publication.
- [ ] **Publisher ownership:** decide whether the developer accounts and app
  identifiers belong to the individual project owner or a DSWA/partner organization.
- [ ] **Legal review:** confirm the Privacy Policy, Terms, retention promises,
  Delaware guidance disclaimer, and data-practice forms.
- [ ] **Brand/partnership review:** obtain permission before presenting DSWA,
  DNREC, school, or government names/logos in a way that implies endorsement.
- [ ] **Backend release:** deploy the latest migrations/functions, test deletion,
  and verify production secrets and rate limits.
- [ ] **Device QA:** run accessibility, weak-network, permission-denial, image,
  authentication, scanner, and deletion tests on representative iOS and Android devices.
- [ ] **Accounts/signing:** enroll in Apple Developer and Google Play Console only
  after ownership is decided, then create signed production builds and complete submission.

## Store media still needed near submission

- Final iPhone screenshots for the App Store device sizes requested at submission time
- Final Android phone screenshots and Play feature graphic
- Optional iPad screenshots if tablet support remains enabled
- Final app icon exported by the native build pipeline
- Review notes explaining that scanner results are limited to official Delaware matches
- A reviewer test account if the stores cannot fully inspect the app without authentication

Do not capture these too early: changing the final layout, account model, legal
copy, or partnership branding would make the media inaccurate.
