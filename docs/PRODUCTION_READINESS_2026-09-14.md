# EcoLearn production readiness review — September 14, 2026

Implementation branch: `codex/production-community-readiness`, based on `main` at `2ad4133`. Production has not been changed. This review covers the current web application in `apps/platform-web` and native application in `apps/mobile-ecolearn`.

## Assessment

The review found concrete release issues in membership handling, teacher onboarding, deletion, simulated product data, mobile moderation, and notification delivery. The local changes address those issues and add regression coverage. They do **not** establish that live email, APNs/FCM, signed native builds, or the production database deployment work: those require the rollout and device checks below.

## Fixed findings

| Area | Finding and resulting behavior |
| --- | --- |
| Teacher/student accounts | Email signup now saves the selected role on both platforms. Unrecognized or forged admin metadata defaults to student. Existing accounts and OAuth users can choose student/teacher in Community. Teacher is a product role, not a verified teaching credential; it never grants access to another person's school or classroom. |
| Creator membership | Creators already belong to their spaces. Reusing their own code is blocked in the UI and database. A student code cannot downgrade a teacher. Deliberate teacher invitations remain supported. Code rotation invalidates old invitations. |
| Classroom management | Teachers can assign published lessons, inspect completion counts, post classroom announcements, delete assignments, and remove students. Duplicate undated assignments and past due dates are rejected. Students can open the exact assigned lesson, including later lessons in the path. |
| Community management | Real organization/community data replaces the organization mockup. Events support cancelling an RSVP; new events require future dates. Managers can delete announcements/events. Existing reporting, blocking, and moderation remain enforced. |
| Space deletion | A community owner or administrator can delete a community. Classroom deletion is limited to its creator or school manager. Confirmation is required in the interfaces. Memberships, content, invitations, and associated notifications are removed; earned learning progress remains. Creators must delete their owned spaces before deleting their account. |
| Membership removal | Teachers can remove students; only the creator or school manager can remove another teacher. The creator cannot be removed. Co-teachers can leave, and leaving a community cannot strand a teacher role in one of its classrooms. |
| Account deletion | Old authored classroom content no longer blocks deletion after a co-teacher leaves. Authorship becomes null. Owned spaces produce an actionable error before account data or photos are removed. |
| Moderation on Android | Replaced an iOS-only report prompt and an oversized native alert menu with a shared report modal, including reasons and optional details. |
| Image feedback | Removed the review UI and training workflow; disabled new feedback table access and storage uploads. Four legacy endpoints return HTTP 410 when redeployed. Historical feedback is retained for existing account-deletion cleanup; no historical data was destructively purged. Normal scanner processing and lesson answer feedback remain. |
| Simulated features | Removed invented impact totals/charts, leaderboard entries, organization memberships, notification cards, and unverifiable challenge rewards. Home, challenges, standings, and admin exports now use saved activity or real navigation. Reward claims are stored per account and checked server-side. |
| Responsive UI and stale state | Signup scrolls on short screens; footer links wrap on narrow screens. Community requests ignore stale results, failed dashboard loads offer retry, and notification refresh avoids replacing unsaved preferences. |
| Dependencies | Updated vulnerable web dependencies and aligned native dependencies with the installed Expo SDK. The scoped Xcode UUID override was smoke-tested through its UUID-generation API. |

## Notifications implemented

- Shared per-account web/app inbox, unread/read state, mark-all-read, loading/error/empty states, and settings.
- Assignments, classroom/community announcements, new events, assignment due reminders, and streak reminders.
- Separate email and mobile-push opt-ins; both default off. Former master-switch opt-outs are preserved. Categories, reminder hour, and timezone are configurable.
- Membership, blocking, moderation, current preferences, email confirmation, device ownership, completed assignments, and already-read status are rechecked before claiming a delivery.
- Email uses Resend; native push uses Expo, with platform permissions and token registration/removal. A shared device rebinds to its current account, and sign-out unregisters it.
- External previews contain general wording, with details behind sign-in. Clients cannot select recipients, insert messages, access delivery jobs, or call the worker without its scheduler secret.
- Database deduplication and leases prevent overlapping claims. Email retries reuse an idempotency key; push receipts remove invalid devices. Failures are recorded and surfaced by the scheduled workflow.
- The scheduler runs approximately every 15 minutes and drains up to 300 deliveries per run in bounded batches. GitHub scheduling is not an exact-time guarantee.

The web feature is an in-app inbox, not background browser Web Push. The native feature includes OS push. The inbox currently shows the most recent 100 visible messages. Category opt-outs hide matching inbox messages as well as stopping delivery. Opting in does not retroactively email old messages. Delivery attempts stop after six claims or 24 hours. An accepted provider response is not proof that a person received or read a message. Push is at-least-once: a crash between provider acceptance and recording it can produce a duplicate. Streak activity retains the existing UTC-day calculation; the reminder hour uses the user's saved timezone.

## Verification

Automated commands run from each application directory:

| Check | Result / coverage |
| --- | --- |
| Web `npm run test:database` | 25 passing tests, including the parent integration test. All repository SQL migrations run in order in PostgreSQL via PGlite. Auth/storage schemas and identities are fixtures. Covers authorization/RLS, self-join, invitations, assignment validation, learning/XP idempotency, RSVP, moderation, reminders, opt-outs, deletion, and retired feedback. |
| Delivery worker tests (included above) | Execute the actual TypeScript handler with fake database/provider transports. Covers unauthorized requests, email/push acceptance, missing configuration, retries, invalid devices, and receipts. No real email or push sent. |
| Web Playwright desktop + mobile Chrome | **52 passed, 4 intentionally skipped**, using `npx playwright test --workers 2`. Authenticated scenarios use isolated Supabase HTTP fixtures; guest checks cover scanner lookup, safe input, gallery/camera controls, maps, location denial, learning, authentication, navigation, and legal pages. |
| Web build, TypeScript, ESLint | **Passed**, with no TypeScript errors or lint findings. |
| Native TypeScript, Expo doctor, iOS/Android JS exports | **Passed**: TypeScript clean, Expo doctor 21/21 checks, and both exports bundle 794 modules successfully. Used `npx expo export --platform ios --platform android --output-dir .expo-validation/readiness --max-workers 2`. Exporting is not a signed Xcode/Gradle build or a physical-device test. |
| Dependency audits | Both applications reported zero known npm vulnerabilities after the dependency updates. This is not a security certification. |

The live website was inspected read-only in the existing session. No production communities, classrooms, accounts, emails, or push devices were created or modified. Two credential-dependent reviewer tests are intentionally skipped, as are two duplicate desktop-only cases in the mobile project. A first parallel run had a resource-contention timeout and exposed the footer overflow; the overflow was fixed and the suite was rerun with two workers.

## Required rollout

1. Review and release this branch through canonical `main`; Netlify production must deploy from `main`. Do not deploy from the legacy `platform-rebuild` branch.
2. Confirm a recoverable database backup and apply the migrations through the intended Supabase migration process, in order:
   - `202609140001_production_memberships.sql`
   - `202609140002_notifications.sql`
   - `202609140003_retire_feedback.sql`
   All prior migrations, including the September 4 moderation migrations, must already be applied. Review against a staging copy of the existing production data before applying to production. The function-deployment workflow does **not** apply SQL migrations.
3. Configure Supabase Edge Function secrets: `NOTIFICATION_CRON_SECRET`, `RESEND_API_KEY`, and `NOTIFICATION_FROM_EMAIL` from a verified sending domain. Configure `EXPO_ACCESS_TOKEN` if Expo enhanced push security is enabled. Never put these values in web/mobile public environment variables.
4. Deploy `deliver-notifications`, the updated `delete-account`, and the four retired endpoint tombstones (`review-feedback`, `export-training-manifest`, `claim-training-batch`, `complete-training-batch`). The existing function deployment workflow deploys every function directory; choose the tested `main` ref.
5. Configure GitHub Actions secrets `SUPABASE_URL` and the same `NOTIFICATION_CRON_SECRET`. Run **Deliver EcoLearn notifications** manually, check the resulting counts and outbox errors, and then confirm scheduled runs occur. The workflow becomes scheduled from the repository's default branch.
6. Deploy the web build after the migrations/functions. Configure Apple APNs and Android FCM credentials for the actual EAS project and create new signed iOS/Android builds. Adding `expo-notifications` requires a native build; an OTA JavaScript update is insufficient. Expo Go is not the push acceptance test.
7. Use dedicated staging teacher/student accounts and installed builds for the acceptance sequence below. Do not reuse real student records for destructive testing.

## Acceptance checks before inviting users

- Create and confirm one teacher account and two student accounts, including an OAuth account. Confirm role persistence across web and native sign-in, password reset, and email deep links.
- Teacher creates a school/class and a separate community. Students join by invitation; owner self-join and unauthorized roster access fail. Rotate a code and verify the old code fails. Exercise removal and leaving.
- Assign a later lesson, open it on each platform, submit an incorrect and then correct answer, and confirm the teacher's completion count and unchanged XP on repeat submission.
- Post an announcement/event, RSVP/cancel, report and block/unblock on both iOS and Android, and remove the content. Confirm it disappears from unauthorized/blocked views and pending notifications.
- Opt into email and push on dedicated test devices; trigger an assignment and a reminder. Verify email arrival, lock-screen/foreground behavior, notification taps, read state, opt-out, sign-out, shared-device account changes, and an uninstalled device receipt.
- Cancel a delete prompt, then delete a test classroom/community. Confirm no orphan membership or notifications and preserved student progress. Verify account deletion for a former co-teacher and the owned-space precondition for creators.
- Exercise real camera/gallery permissions, barcode/photo analysis, location denied/allowed, map tiles, and provider/network failures on installed iOS and Android builds.

## Further production work to prioritize

The remaining work is operational acceptance, not a reason to restore sample content: monitor email bounces/provider errors and notification backlog; run a representative multi-classroom load test; and decide whether teacher identity verification or school-admin approval is required beyond self-selected roles. Ownership transfer is a useful future addition for staff turnover; the current supported action is explicit deletion by the owner/manager. Background browser push can be added separately if needed.

Provider references: [Expo push setup](https://docs.expo.dev/push-notifications/push-notifications-setup/), [Expo sending and receipts](https://docs.expo.dev/push-notifications/sending-notifications/), [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys).
