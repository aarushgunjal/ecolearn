# EcoLearn repository audit - 2026-08-20

Scope: active web app, Expo app, Supabase functions/workflows, dependency manifests,
route/deploy configuration, lesson content, scanner result UI, and map lookup.

## Corrected in this review

For the final test matrix, load results, security controls, deployment order, and
remaining device-only checks, see
`docs/COMPREHENSIVE_QA_SECURITY_STRESS_AUDIT_2026-08-20.md`.

- **Broken official-location relationship:** `find-disposal-sites` treated an exact
  item title as the only organization tag. Specific records such as `Can opener`
  therefore returned no locations even though DNREC connects them to the broader
  `Electronics` solution. The function now follows the matched DNREC topic's own
  related solution tags and reports the matched category to the UI.
- **Missing mobile electronics map filter:** the mobile UI sent `electronics`, but
  the function had no such OpenStreetMap filter and silently used generic
  recycling. It now uses the electrical-appliance recycling tag.
- **Web/mobile lesson drift:** web exposed six lessons while Expo exposed four,
  and three shared lesson quizzes differed. Expo now uses the same six IDs,
  titles, topics, XP, questions, choices, answers, and explanations as web.
- **Unused scanner feedback UI:** the learner-facing prompt had been removed, but
  its standalone component still remained and could be reintroduced by mistake.
  The unused component is now deleted. Historical admin/training records were not
  destructively removed.
- **Conflicting native framework in the web package:** the active web app carried
  unused Capacitor 8 runtime packages with a Capacitor 7 CLI while the maintained
  native app is Expo 57. Those unused packages and scripts are removed.
- **Expo 57 patch drift and transitive import:** seven Expo modules were behind
  Expo's expected SDK 57 patch versions, and `expo-constants` was imported without
  being declared directly. The compatible patches are installed and
  `expo-constants` is now explicit.
- **DSWA video relevance:** official DSWA videos are now centralized in one data
  registry, placed in the learning path, and selected from scanner category data.
  Electronics results explicitly select DSWA's electronics-recycling video.

## Verified

- Active web lint: pass.
- Active web production build: pass.
- Playwright regression suite: 30 passed, 2 intentionally skipped across desktop
  Chromium and Pixel 7 mobile-web emulation.
- Mobile TypeScript check: pass.
- Expo SDK 57 dependency compatibility check: pass.
- Web production dependency audit: 0 known vulnerabilities.
- Merge-conflict marker and obvious committed-secret scan: no findings.
- Supabase deploy workflow discovers and deploys all 14 current function
  entrypoints, including `delete-account`, barcode, label, map, and admin tools.
- Netlify SPA redirect exists at `apps/platform-web/public/_redirects`.

## Open findings and recommendations

1. **Two web applications remain in the repository.** The deployable platform is
   `apps/platform-web`; the root Vite project is legacy. The canonical public
   domain is now `ecolearn.dev`.
   Confirm the desired domain/redirect strategy, then archive or remove the root
   app in a dedicated change. It was not deleted during this audit because that
   would be destructive and could affect the existing domain.
2. **The web bundle is approximately 668 kB minified.** It builds successfully but
   exceeds Vite's 500 kB warning threshold. Lazy-load the admin and extended hub
   views before a school pilot; this is a performance task, not a correctness bug.
3. **Expo's current dependency tree is reported by npm audit with high/moderate
   Metro/CLI advisories.** npm proposes downgrading Expo to SDK 53, which conflicts
   with the required SDK 57 and is not a safe automated fix. Track Expo 57 patch
   releases and rerun `expo-doctor`/`npm audit`; do not apply the suggested major
   downgrade blindly. The findings are primarily build-tool paths, not the web
   production bundle.
4. **Legacy/experimental model-training functions remain in source.** The deploy
   workflow now deploys every valid function directory so source and production
   cannot silently drift. Formally retire unused endpoints before handing the
   repository to DSWA.
5. **Lesson content is duplicated in web and Expo source.** This review restored
   parity; a future refactor should move lesson data into a shared package so it
   cannot drift again.

## Deferred by product decision

Teacher-managed classrooms, class codes, aliases/avatars, educator assignments,
class leaderboards, and supervised maintenance agents are documented in
`roadmap.md`. They are intentionally not implemented until DSWA Education replies
and the under-13 privacy/data model is approved.
