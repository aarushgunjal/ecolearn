# EcoLearn Product Roadmap

_Working roadmap — August 2026_

## Product principle

EcoLearn should make the correct Delaware action easier than the incorrect one:
identify an item, verify the exact official rule, find the next step, and build a
habit that lasts. Accuracy, youth privacy, accessibility, and local authority
take priority over novelty.

## Completed foundation

- [x] Delaware-only DNREC guidance catalog, sync workflow, and live fallback.
- [x] Exact official item autocomplete and item-filtered Delaware locations.
- [x] OpenRouter constrained to selecting an official DNREC title or no match.
- [x] Historical consent-first feedback and human admin review infrastructure;
      the learner-facing feedback prompt is intentionally removed.
- [x] Server-controlled progress, lesson completion, rewards, and achievements.
- [x] Expo scanner and EcoLearn companion foundations.
- [x] Shareable platform routes and protected admin navigation.

## Now: pilot readiness

- [ ] Apply and verify all Supabase migrations in order, including
  `202608020001_secure_delaware_platform.sql`.
- [ ] Deploy the current Edge Functions and run the DNREC refresh workflow.
- [ ] Run authenticated end-to-end tests against a dedicated staging Supabase
  project, including rate limits, duplicate requests, consent, and admin review.
- [ ] Build a Delaware-relevant validation set and record exact-item match,
  no-match, and location accuracy.
- [ ] Complete WCAG 2.2 AA and mobile-device testing.
- [ ] Replace remaining motivational sample data before a public launch.

## School pilot decisions

- [ ] Agree on grade range, pilot school or community group, and teacher owner.
- [ ] Define parent/district consent, retention, deletion, and incident response.
- [ ] Confirm whether students use individual, pseudonymous, or teacher-managed
  accounts.
- [ ] Have the appropriate Delaware authority validate priority item protocols
  and location information.
- [ ] Define privacy-preserving pilot metrics and an update owner for DNREC data.

## Awaiting DSWA Education direction - do not implement yet

The August 2026 DSWA Education discussion points toward a teacher-led product,
but implementation is paused until DSWA responds and the school privacy model is
agreed. The preferred flow is:

`teacher creates classroom -> EcoLearn generates class code -> student joins with
an assigned safe alias/avatar -> lessons and quests earn XP -> teacher reviews
class-level progress`

Candidate capabilities, subject to approval, are educator-created assignments,
lesson preview, printable QR/join codes, student-safe aliases, class-specific
leaderboards, lesson analytics, accessibility settings, classroom achievements,
and ready-made sustainability activities. Do not require a primary-school learner
to manage email verification or an independent profile by default.

The same hold applies to maintenance agents. The proposed model is supervised
automation that can diagnose issues, open an issue, create a branch, run tests,
and prepare a pull request. It should not silently change production data, rotate
production secrets, or deploy directly. A future system-health page should report
DNREC sync, database, scanner success, OpenRouter spend/cap, site and app status,
security review age, dependency updates, and open issues.

## Next: product depth

- [ ] Add age-appropriate pathways for primary, middle, and secondary students.
- [ ] Add teacher-managed classes, assignments, and moderated challenges.
- [ ] Add address or postal-code location selection without device permission.
- [ ] Surface source update dates, accessibility notes, and program eligibility.
- [ ] Add operational monitoring for function errors, provider outages, catalog
  sync failures, and scanner latency.

## Later: advanced vision

- [ ] Reconsider multi-item scanning only after the single-item flow has pilot
  accuracy and cost data; keep one model request per photo during experiments.
- [ ] Prefer one structured multi-item response before introducing detection,
  crops, bounding boxes, or separate per-object model calls.
- [ ] Add human review for any future per-object corrections.
- [ ] Validate performance by object size, clutter, lighting, and Delaware pilot
  categories before making any public capability claim.
