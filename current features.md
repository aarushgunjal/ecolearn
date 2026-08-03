# EcoLearn — Current Features

_Platform snapshot — August 2, 2026_

EcoLearn is a Delaware-first learning and waste-guidance platform for students,
beginning with primary-school use cases. The platform combines official DNREC
Recyclopedia data, guided learning, progress, and privacy-conscious feedback.

## Delaware guidance and scanning

- Photo classification and exact-item text search.
- Official DNREC autocomplete, item protocols, source links, and item-specific
  Delaware locations.
- A strict verified-result boundary: broad classifier labels never become
  disposal instructions.
- A user-requested visual catalog check through OpenRouter. The model may select
  only an exact title from the official DNREC catalog; the server returns the
  corresponding official record or no recommendation.
- Live DNREC lookup with the synchronized Supabase mirror as a resilience
  fallback.
- Image type and size validation, student privacy reminders, and no storage of
  images used only for the visual catalog check.

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

- Expo EcoLearn companion with authentication, verified scanning, feedback,
  lessons, quests, profile, and practical tools.
- Standalone Expo scanner for broad visual identification only; it deliberately
  does not issue disposal instructions without a signed-in official DNREC match.

## Deferred or external work

- Multi-object detection remains parked and uncommitted.
- Production database migrations, Edge Function secrets, and deployments must
  be applied to the connected Supabase project.
- A school pilot still requires an agreed youth-privacy, consent, retention,
  accessibility, and teacher-managed account model.
