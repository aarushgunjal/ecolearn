# EcoLearn Open-Source and Third-Party Audit

Audit date: August 31, 2026
Audited applications: `apps/platform-web` and `apps/mobile-ecolearn`
Purpose: web distribution, TestFlight, and Apple App Store readiness

This is an engineering compliance review, not legal advice. License conclusions are based on the manifests, lockfiles, installed package metadata, source usage, native podspec metadata, and bundled assets present at the audit date.

## 1. Executive summary

**Overall package-license risk: LOW.** The audited application dependencies are overwhelmingly permissive. No AGPL, GPL-only, LGPL, SSPL, Commons Clause, BSL/BUSL, Elastic License, non-commercial, or unknown direct runtime dependency was found. The one GPL reference is `node-forge`, which is dual-licensed **BSD-3-Clause OR GPL-2.0** and is used through Expo CLI; EcoLearn can and does rely on the BSD option.

There is no dependency-license reason, by itself, to withhold the current build from TestFlight or App Store Connect. Public App Store release still has two non-package issues requiring resolution:

- **HIGH — third-party content permission:** repository evidence does not establish permission to reproduce or transform DNREC Recyclopedia text, DSWA facility data, or DSWA educational videos beyond linking/embedding and attribution. Confirm the intended reuse with DNREC/DSWA or narrow the implementation to clearly permitted linking/API use.
- **BLOCKER — child privacy/release configuration, not open-source licensing:** EcoLearn is child-directed and uses accounts, class membership, progress, optional photos, and optional precise location. A supervised parent/school consent workflow, direct notice, retention/deletion procedure, App Store privacy labels, and a Kids Category/location decision must be finalized before a broad elementary-school launch.

## 2. Method and inventory scope

Reviewed:

- root and app `package.json` files and npm lockfiles;
- installed production dependency metadata (`license`, repository, package LICENSE/NOTICE files);
- 39 installed production packages in the web dependency closure;
- 481 packages in the mobile production/Expo dependency closure, including optional platform packages;
- Expo configuration, React Native and package podspec metadata, and dynamically generated native dependencies;
- source imports and integrations in both production apps and Supabase Edge Functions;
- static/public assets and mobile application icon/splash assets;
- external data, maps, video, LLM, authentication, deployment, and hosting services.

Routine permissive transitive packages are grouped. Material exceptions are listed individually below.

## 3. Direct dependency audit

### Production web

| Dependency | Installed | Purpose | License | Attribution / text | Disclosure | Concern |
| --- | ---: | --- | --- | --- | --- | --- |
| `@radix-ui/react-slot` | 1.3.0 | UI primitive | MIT | Preserve notice/text | No | Low |
| `@radix-ui/react-toast` | 1.2.17 | Toast UI | MIT | Preserve notice/text | No | Low |
| `@supabase/supabase-js` | 2.108.2 | Auth/data/functions | MIT | Preserve notice/text | No | Low |
| `class-variance-authority` | 0.7.1 | Style variants | Apache-2.0 | Include license; no package NOTICE found | No | Low |
| `clsx` | 2.1.1 | CSS utility | MIT | Preserve notice/text | No | Low |
| `leaflet` | 1.9.4 | Web map | BSD-2-Clause | Reproduce copyright/conditions/disclaimer | No | Low |
| `lucide-react` | 0.462.0 | Icons | ISC | Preserve copyright/permission | No | Low |
| `react` | 18.3.1 | UI runtime | MIT | Preserve notice/text | No | Low |
| `react-dom` | 18.3.1 | Web renderer | MIT | Preserve notice/text | No | Low |
| `tailwind-merge` | 2.6.1 | CSS utility | MIT | Preserve notice/text | No | Low |

The installed web production closure contained 35 MIT, one Apache-2.0, one BSD-2-Clause, one ISC, and one 0BSD package.

### Production mobile

| Dependency | Installed | Purpose | License | Attribution / text | Disclosure | Concern |
| --- | ---: | --- | --- | --- | --- | --- |
| `@expo/vector-icons` | 15.1.1 | Icons/fonts | MIT plus upstream icon-family terms | Preserve notices | No | Low; inventory icon families if new ones are added |
| `@react-native-async-storage/async-storage` | 2.2.0 | Device storage | MIT | Preserve notice/text | No | Low |
| `@supabase/supabase-js` | 2.111.0 | Auth/data/functions | MIT | Preserve notice/text | No | Low |
| `expo` | 57.0.18 | Mobile framework | MIT | Expo copyright and MIT text | No | Low |
| `expo-apple-authentication` | 57.0.1 | Sign in with Apple | MIT | Preserve notice/text | No | Low |
| `expo-constants` | 57.0.16 | Runtime config | MIT | Preserve notice/text | No | Low |
| `expo-crypto` | 57.0.2 | Nonce generation | MIT | Preserve notice/text | No | Low |
| `expo-dev-client` | 57.0.16 | Development client | MIT | Preserve notice/text | No | Low; ensure production profile excludes development behavior |
| `expo-file-system` | 57.0.6 | Local image access | MIT | Preserve notice/text | No | Low |
| `expo-font` | 57.0.2 | Icon-font loading | MIT | Preserve notice/text | No | Low |
| `expo-image-picker` | 57.0.14 | Camera/gallery | MIT | Preserve notice/text | No | Low |
| `expo-linking` | 57.0.8 | OAuth/reset deep links | MIT | Preserve notice/text | No | Low |
| `expo-location` | 57.0.14 | Nearby-site search | MIT | Preserve notice/text | No | **Privacy-sensitive, not license-sensitive** |
| `expo-splash-screen` | 57.0.8 | Launch screen | MIT | Preserve notice/text | No | Low |
| `expo-status-bar` | 57.0.1 | Status-bar styling | MIT | Preserve notice/text | No | Low |
| `expo-system-ui` | 57.0.3 | Native UI styling | MIT | Preserve notice/text | No | Low |
| `expo-web-browser` | 57.0.2 | OAuth/external links | MIT | Preserve notice/text | No | Low |
| `react` | 19.2.3 | UI runtime | MIT | Preserve notice/text | No | Low |
| `react-native` | 0.86.3 | Native runtime | MIT | Preserve notice/text | No | Low |
| `react-native-maps` | 1.27.2 | Native maps | MIT | Preserve notice/text | No | Low; map-provider terms apply separately |
| `react-native-url-polyfill` | 4.0.0 | URL compatibility | MIT | Preserve notice/text | No | Low |

## 4. Material transitive-license exceptions

| Component | Version | Path/use | License | Finding |
| --- | ---: | --- | --- | --- |
| `lightningcss` + optional platform packages | 1.33.0 | Expo Metro build tooling | MPL-2.0 | File-level copyleft. No EcoLearn source disclosure is triggered by unmodified tooling use. If an MPL file is modified and distributed, publish that file and notices under MPL-2.0. |
| `node-forge` | 1.4.0 | Expo CLI code signing | BSD-3-Clause OR GPL-2.0 | Elect BSD-3-Clause. Not a GPL blocker. |
| `caniuse-lite` | 1.0.30001806 | Browser compatibility/build data | CC-BY-4.0 | Attribution preserved in notices/package metadata; not application creative content. |
| `argparse` | 2.0.1 | Expo CLI via `js-yaml` | Python-2.0 | Permissive-style notice obligations; build tooling only. |
| `big-integer` | 1.6.52 | Expo transitive tooling | Unlicense | No reciprocal obligation. |
| `stream-buffers` | 2.2.0 | Expo transitive tooling | Unlicense | No reciprocal obligation. |
| `fb-dotslash` | 0.5.8 | Expo transitive tooling | MIT OR Apache-2.0 | Permissive option available. |

No material Apache `NOTICE` file was found in a shipped direct runtime package. Where an upstream package later adds one, it must be copied with the license notice.

## 5. Native iOS / Expo dependencies

Expo's native modules, React Native, Async Storage, and React Native Maps expose permissive package or podspec licenses. React Native's third-party podspecs include permissive MIT, Apache-2.0, BSD, Boost Software License, and Google/glog notices. No GPL-only or LGPL native framework was identified.

The iOS project is generated by EAS/Expo rather than checked in. Repeat this audit after any Expo SDK, React Native, config-plugin, or native dependency upgrade because the resolved CocoaPods graph can change independently from JavaScript source.

## 6. Third-party assets

| Asset/resource | Location/use | Basis found | Severity/action |
| --- | --- | --- | --- |
| EcoLearn app icons and splash PNGs | `apps/mobile-ecolearn/assets` | No provenance record in repository | **MEDIUM:** owner should confirm they are original or licensed and retain source/commission records. |
| Lucide icons | Web | ISC package | Low; covered by notices. |
| Expo Vector Icons/icon fonts | Mobile | Package and upstream family licenses | Low; covered generally. Recheck if using a family with special trademark terms. |
| DSWA videos | Web embeds; mobile external links | Official DSWA/YouTube sources; no written reuse permission in repository | **HIGH:** embedding may be allowed by platform settings, but DSWA content permission and brand use should be confirmed. Do not download/rebundle videos without permission. |
| DNREC Recyclopedia text/data | Scanner, lessons, locations | Public government source; no explicit reuse license recorded | **HIGH:** attribution is present, but public accessibility is not proof of redistribution/derivative-work permission. Obtain confirmation or written terms. |
| DSWA facility names/addresses/services | Location function | Hard-coded from DSWA pages | **HIGH:** confirm data reuse and update expectations. |
| OpenStreetMap data/tiles | Web map and fallback facility lookup | ODbL data; tile usage policy | Low at current scale if attribution/policy followed; **MEDIUM scaling risk** because public tiles have no SLA and prohibit heavy use. |
| Open Food Facts product text | Barcode lookup | ODbL database/content terms | Low for live lookup with attribution; review share-alike/database obligations before caching or building a persistent derived catalog. Product images are not currently redistributed. |

No bundled stock photos, videos, sound files, custom fonts, or third-party illustrations were found in the production app asset directories.

## 7. External services and data terms

External services are not bundled open-source libraries. Their contracts, privacy terms, and acceptable-use rules apply separately.

| Service | Use | Terms/attribution | App Store/privacy action |
| --- | --- | --- | --- |
| Supabase | Auth, database, storage, Edge Functions | https://supabase.com/terms and https://supabase.com/privacy | Disclose as processor/service provider; configure retention, RLS, deletion, and child-data terms. |
| OpenRouter and selected model providers | Image/label analysis and guidance | https://openrouter.ai/terms and https://openrouter.ai/docs/guides/privacy/data-collection | **HIGH privacy:** disclose image/prompt transfer, select no-retention providers/settings, cap usage, and verify no training/retention claims against live configuration. |
| DNREC Recyclopedia | Official disposal guidance and locations | Source links displayed; reuse license not established | Confirm written permission/data terms. |
| DSWA | Videos and facility information | Source attribution/links displayed; reuse license not established | Confirm permission before public marketing/release. |
| OpenStreetMap | Map data, public tiles, fallback sites | Attribution required; https://operations.osmfoundation.org/policies/tiles/ | Attribution exists. Use a supported tile provider before material scale; obey caching/referer/user-agent limits. |
| Open Food Facts | Barcode product lookup | ODbL/database/content terms | Add/retain attribution and do not persist a derived database without ODbL review. |
| Expo / EAS | Builds, credentials, delivery infrastructure | https://expo.dev/terms | Operational vendor; disclose only if its processing is relevant to collected user data. |
| Netlify | Web hosting | https://www.netlify.com/legal/self-serve-subscription-agreement/ | Review logs/cookies and list as hosting processor where appropriate. |
| YouTube privacy-enhanced embeds | DSWA video playback on web | YouTube embedded-player requirements | Maintain player branding/functionality and disclose third-party embeds/cookies. |
| Google / Apple authentication | OAuth/Sign in with Apple | Platform terms | App privacy labels must reflect identifiers/contact data actually received. |
| Google Maps directions links | External directions | Link-out only | No embedded Google map SDK was identified on web. |

No active Resend, advertising SDK, crash-reporting SDK, or analytics SDK was found in the production app source reviewed.

## 8. Attribution requirements and implemented notices

- Added root `THIRD_PARTY_NOTICES.md` with direct package notices, license texts/links, material transitive exceptions, and data attribution.
- Added a public `/licenses` page and mobile Profile link.
- Added `apps/platform-web/public/third-party-notices.txt` so notices ship with the web build and remain available to mobile users.
- Preserved on-map OpenStreetMap attribution.
- Preserved DNREC source links and DSWA source/video links.
- Replaced the misleading mobile template-level `LICENSE` file (which named only Expo) with a repository-level proprietary copyright statement and separate third-party notices.

## 9. Copyleft and custom-license risk

- No GPL-only/AGPL/LGPL/SSPL/custom non-commercial runtime package was found.
- `node-forge` is dual-licensed and the BSD-3-Clause option is compatible with proprietary distribution.
- MPL-2.0 `lightningcss` is build tooling with file-level obligations and does not impose MPL on EcoLearn's code.
- No dynamic/static LGPL linking issue was identified.

**Apple conclusion:** the audited package licenses do not conflict with App Store DRM/distribution terms. Required permissive notices should remain accessible in each shipped version.

## 10. Unknowns and provenance gaps

- Written permission or explicit licensing terms for DNREC-derived instructions/data and DSWA facility/video use are not in the repository.
- Original ownership/license records for the EcoLearn icon and splash PNGs are not in the repository.
- The repository contains no legal record of the operator entity, school agreements, parent consent method, or child-data retention schedule.
- Live OpenRouter model/provider routing and retention settings cannot be proven from source code alone.
- App Store privacy answers and age-rating choices were not available in the repository and must match the final binary/configuration.

## 11. Changes made in this audit

- Created human-readable third-party notices and a proprietary copyright statement.
- Added a styled web Open Source Licenses page and public notices file.
- Added a mobile Profile link to the same production legal page.
- Replaced package-root Vector Icons imports with direct Ionicons imports. The verified iOS and Android exports now bundle only the app icon and Ionicons font instead of all 19 available icon-font families; the JavaScript bundle also fell from approximately 2.8 MB to 2.5 MB.
- Corrected the privacy policy to describe EcoLearn as intended for elementary students under supervised parent/school arrangements.
- Added password-recovery UI to web to match the existing mobile recovery flow.
- Added compliance, parity, recovery, and App Store media documentation.

## 12. Items requiring the owner's decision

1. Obtain and retain written DNREC/DSWA permission or choose a link-only/API-only content strategy.
2. Confirm and document ownership of every app icon/splash asset.
3. Decide whether EcoLearn will enter Apple's Kids Category. Location and third-party data handling must be designed around that choice.
4. Choose and document the verified parent-consent or authorized-school-consent workflow before under-13 production onboarding.
5. Confirm OpenRouter/model-provider retention and training settings in the live account.
6. Choose a supported map tile provider before usage makes the public OSM tile service unsuitable.
7. Have qualified counsel review child privacy, school consent, terms, and the final privacy policy before broad public-school deployment.

## 13. Recommended pre-App-Store actions

1. Keep the current build in internal TestFlight while resolving the privacy/content-rights items above.
2. Add the web and mobile reset redirect URLs to the Supabase Auth allowlist and test one real recovery link on the TestFlight build.
3. Complete the child-directed data-flow inventory, retention schedule, parent/school direct notice, consent records, and deletion verification.
4. Reconcile App Store Connect privacy labels with actual Supabase, OpenRouter, location, photo, authentication, and account-deletion behavior.
5. Capture final App Store screenshots and preview video from the actual TestFlight build using fictional review data.
6. Preserve this report and `THIRD_PARTY_NOTICES.md` with the release record, and rerun after dependency/content/provider changes.

## 14. Validation record

- Web ESLint: passed.
- Web production Vite build: passed. One non-blocking bundle-size warning remains for the approximately 701 KB minified main chunk; future route-level code splitting is recommended.
- Web Playwright suite: 36 passed across desktop Chromium and mobile Chromium; 4 authenticated-review variants were skipped because review credentials were intentionally not supplied to the local test process. Password-reset request coverage passed in both browser profiles.
- Expo Doctor: 21/21 checks passed.
- Mobile TypeScript: passed with `tsc --noEmit`.
- Expo public config resolution: passed.
- iOS export: passed; 734 modules, 2.5 MB Hermes bundle, two bundled assets (EcoLearn icon and Ionicons font).
- Android export: passed; 732 modules, 2.5 MB Hermes bundle, two bundled assets (EcoLearn icon and Ionicons font).
- Web `npm audit --omit=dev`: zero known vulnerabilities.
- Mobile `npm audit --omit=dev`: reports 11 moderate findings, all traced to Expo CLI/config/build tooling and `xcode` → `uuid`, not to an invoked application runtime path. npm's suggested downgrade to Expo 46 is unsafe and was not applied. Track an Expo-compatible upstream fix; no high or critical finding was reported.
