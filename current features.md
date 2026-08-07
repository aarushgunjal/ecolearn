# EcoLearn — Current Features

_Platform snapshot — August 7, 2026_

EcoLearn is a Delaware-first learning and waste-guidance platform for students,
beginning with primary-school use cases. The platform combines official DNREC
Recyclopedia data, guided learning, progress, and privacy-conscious feedback.

## Delaware guidance and scanning

- One-call visual item identification and exact-item text search.
- Official DNREC autocomplete, item protocols, source links, and item-specific
  Delaware locations.
- A strict verified-result boundary: the vision model identifies a specific
  visible item but never produces disposal instructions.
- Deterministic server-side matching of that item name against the synchronized
  DNREC catalog. Only a strong, unique official match produces a protocol.
- Mixed, unclear, and unmatched photos return an observed item when possible,
  safe next steps, and an explicit no-match state instead of generic guidance.
- Live DNREC lookup with the synchronized Supabase mirror as a resilience
  fallback.
- Separate gallery and camera controls, image resizing/type validation, student
  privacy reminders, and no storage of images used only for the visual check.

## Learning, motivation, and accounts

- Six Delaware-aware lessons with quizzes, ordered unlocking, and saved
  completion state.
- XP, levels, streaks, achievements, quests, and scan history.
- Email/password and Google authentication with a remember-me preference.
- Profile, notification, school, organization, community, local-rules, and
  scanner-tool surfaces.
- Shareable routes for the main platform areas, privacy policy, and terms.

## Security and responsible improvement

- Server-controlled scan, lesson, reward, XP, streak, and achievement updates;
  the browser cannot directly mint progress.
- Idempotent scan recording, duplicate protection, and per-user limits for
  OpenRouter visual catalog checks.
- Consent-first scan feedback with human admin review before an image can enter
  the model-improvement pipeline.
- Admin access controlled by the existing Supabase `app_admins` allow-list.
- Automated private training batches and promotion gates for model updates.

## Mobile surfaces

- Both mobile apps target Expo SDK 57 and React Native 0.86.
- Expo EcoLearn companion with authentication, verified scanning, feedback,
  lessons, quests, profile, and practical tools.
- Standalone Expo scanner aligned with the signed-in one-call visual identifier
  and the same verified DNREC boundary as the main mobile app.

## Deferred or external work

- Multi-object detection remains parked and uncommitted.
- Production database migrations, Edge Function secrets, and deployments must
  be applied to the connected Supabase project.
- A school pilot still requires an agreed youth-privacy, consent, retention,
  accessibility, and teacher-managed account model.
