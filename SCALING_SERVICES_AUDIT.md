# EcoLearn service and scaling cost audit

**Last full review:** August 20, 2026
**Scope:** `apps/platform-web`, `apps/mobile-ecolearn`, Supabase Edge Functions,
GitHub automation, model-training automation, DSWA Education video embeds, and
the Netlify-hosted `ecolearn.dev` web application. The older root Vite app
remains a legacy code surface and should not be mistaken for
the active platform build.
**Owner:** EcoLearn project owner; transfer budget ownership to DSWA or another
partner before an organization-sponsored launch.

This is a living operational document, not a quote. Prices and free allowances
change. Verify every linked provider page before approving a budget or signing
a contract. Amounts below are USD and exclude tax.

## Executive recommendation

The current free stack is appropriate for development and a small pilot. It is
not a dependable production stack for a school or statewide rollout. The first
funded upgrades should be:

1. **OpenRouter pay-as-you-go credits and an API-key hard budget.** Free models
   are limited and explicitly described as unsuitable for production. Keep the
   app-side rate limits as a second layer.
2. **Supabase Pro and production SMTP.** This prevents inactive-project pausing,
   adds backups/support/capacity, and makes account verification/reset email
   deliverable to real users.
3. **A funded Netlify tier and commercial map service** before traffic makes the
   current hard credit ceiling or community OpenStreetMap infrastructure unreliable.
4. **Expo Starter during active release work**, moving to Production only when
   a team needs higher update/build capacity and support.
5. **Monitoring, alerting, and a funded incident owner** before inviting schools.

## What protects LLM usage today

- The primary visual scanner performs one LLM request per image; deterministic
  DNREC matching does not make a second LLM call.
- Each signed-in user is limited to 10 visual scans per rolling hour by default.
- The scanner now has a configurable global rolling-day ceiling of 45 calls,
  leaving a small buffer below OpenRouter's current 50-request free allowance.
- Set Supabase secrets `AI_USER_REQUESTS_PER_HOUR` and
  `AI_GLOBAL_REQUESTS_PER_DAY` to change those application limits after funding.
- OpenRouter 402 and 429 responses fail closed and direct users to the free
  exact-item search instead of retrying and multiplying cost.
- Responses are capped at 240 tokens. Images are resized/compressed by the web
  client before upload.

The global application limit is a safety net, not the billing authority. Its
current count-then-record check can briefly overshoot during simultaneous
requests, and other AI tools can share the same OpenRouter key. Configure a
separate production API key with a daily or monthly budget/guardrail in
OpenRouter. The lower of the OpenRouter key budget and EcoLearn's application
limit should win.

For a paid model, calculate the budget from observed use rather than guessing:

`monthly AI budget = completed visual requests × 30-day average cost/request × 1.30 safety factor`

Record the configured model, average image size, average cost, p95 latency, and
failure rate here after every model change.

## Current service register

| Service currently used | EcoLearn workload | Current free/development risk | Recommended funded state | Upgrade trigger |
| --- | --- | --- | --- | --- |
| **Supabase** | Postgres, Auth, Storage, RLS, RPCs, Edge Functions | Free currently includes 500 MB database, 1 GB storage, 5 GB egress and 50,000 MAU; inactive free projects may pause and free projects lack downloadable backups | **Pro from $25/month**; scale compute and PITR only when metrics justify it | Any public/school pilot, need for backups, approaching 60% of storage/egress/database, or recurring cold starts/pauses |
| **Supabase default Auth email** | Signup confirmation and password reset | Best-effort development SMTP is currently limited to team addresses and about 2 messages/hour; not a production sender | Configure custom SMTP. **Resend Pro is currently $20/month for 50,000 transactional emails**, although its free tier can support a tiny pilot | Before accepting public email/password registrations |
| **OpenRouter** | Vision item identification and label reading; dormant/secondary AI functions also exist | Free plan is currently 50 requests/day and community support; free models can be unavailable or rate-limited | Pay-as-you-go credits, isolated production key, hard budget, ZDR/data-policy guardrail, and a pinned affordable vision model; Enterprise only if DSWA needs SLA/contract terms | Before more than a handful of testers, or when daily demand exceeds 35 scans |
| **Expo / EAS** | Shared iOS/Android app builds and eventual updates/submission | Free currently includes 15 Android + 15 iOS builds, low-priority queues, and updates to 1,000 MAU | **Starter $19/month** during normal launch work; **Production $199/month** only for a release team needing priority/support/50,000 update MAU | Starter when signed builds begin; Production when DSWA owns a team release process or updates exceed Starter limits |
| **GitHub Free + Actions** | Source, reviews, Supabase deploys, daily DNREC sync, hourly training poll | Public standard runners are free; private GitHub Free includes 2,000 minutes and 500 MB artifacts. The hourly training workflow can waste minutes even when no batch exists | Keep public/open if acceptable; otherwise budget Team and metered Actions. Add budgets, alerts, concurrency, caching, and less-frequent/event-driven training | Private organization ownership, protected review requirements, Actions above 70% allowance, or paid staff collaboration |
| **Netlify** | Active Vite SPA hosting for `ecolearn.dev`, deploy previews, redirects, global CDN | Free has a hard 300-credit monthly limit. Bandwidth uses 20 credits/GB, web requests 2 credits/10,000, and production deploys 15 credits; all projects pause at the limit | **Personal $9/month / 1,000 credits** for a supervised pilot; **Pro starts at $20/month / 3,000 credits** for a team and longer analytics. Keep auto-recharge off until a budget owner approves it | Personal before real traffic; Pro when DSWA needs shared ownership, private organization repos, 30-day metrics, or usage approaches 70% of the monthly credits |
| **Delaware DNREC Recyclopedia API** | Official catalog sync, live verification, and location data | Public external dependency with no EcoLearn-controlled SLA or paid capacity contract found | Keep the versioned Supabase mirror, daily sync, provenance, health checks, and a documented contact/permission path with DNREC/DSWA | Partnership launch or repeated API failures/schema changes |
| **OpenStreetMap tiles + public Overpass API** | Map display and nearby fallback search | Community infrastructure is best-effort and may block heavy use; the main Overpass guidance treats under 10,000 queries/day and 1 GB/day as a safe assumption, not an SLA | Commercial OSM provider or partner-hosted service. MapTiler Flex currently starts at **$25/month** for commercial use; evaluate alternatives and Delaware-only caching | More than a small pilot, commercial/organization launch, or sustained map usage above 5,000 searches/day |
| **Open Food Facts API** | Barcode product lookup | Free/open service; product reads are limited to 15 requests/minute/IP. Code currently uses deprecated API v2 | Upgrade to API v3, cache barcode results in Supabase, identify the app to OFF, then mirror daily exports or self-host if volume grows | Before public barcode promotion, repeated 429/503 responses, or hundreds of daily lookups |
| **Google OAuth** | Optional Google sign-in | No direct per-login bill in the current integration, but production consent-screen, branding, redirect, privacy, and organizational ownership still matter | DSWA/organization-owned OAuth project and credentials; separate dev/prod clients | Before signed mobile release or organization ownership transfer |
| **Google Maps links** | Opens directions in the user's Maps/browser | Current code opens public Maps URLs and does not call a billed Maps SDK/API | Keep as external links, or budget a licensed maps SDK only if embedded routing/places becomes a product requirement | Embedded maps, route computation, place details, or an SLA requirement |
| **YouTube / DSWA Education** | Seven official DSWA videos are embedded with `youtube-nocookie.com` and linked to DSWA's library | No direct hosting bill, but playback is an external dependency and clicking play still contacts YouTube/Google | Keep privacy-enhanced lazy embeds, provide titles/transcripts or accessible summaries, and obtain DSWA confirmation that embedding is acceptable for school use | Before school deployment, if district filters block YouTube, or if DSWA provides approved self-hosted/captioned assets |
| **Google Fonts** | Web typography | Free CDN dependency leaks a network request to Google and adds an external availability dependency | Self-host the licensed font files in the web bundle for privacy, consistency, and offline resilience | Before a school/privacy-reviewed launch |
| **Kaggle** | Free GPU/notebook training target used by automation | Free compute quota and availability are not guaranteed; no suitable paid production SLA is built into the current automation | Move repeatable training to a funded GPU job service or DSWA cloud account; keep Kaggle for experiments | Scheduled retraining, private student-derived datasets, or a required training completion time |
| **Hugging Face Hub/Space** | Model artifact storage and classifier hosting/promotion | Free storage/compute and best-effort limits are fine for experiments | PRO **$9/month** for an individual experiment; Team **$20/user/month** or Enterprise from **$50/user/month**, plus paid hardware, when the model becomes operational | Private production models, multiple maintainers, access controls, audit logs, or uptime expectations |
| **npm/open-source packages** | React, Expo, Supabase SDK, UI and build tooling | No license fee, but dependency, security, and upgrade labor is real | Fund maintenance time, automated dependency review, lockfile scanning, and periodic Expo/React upgrades | Monthly maintenance cadence and before each store release |
| **Domain registration and DNS** | `ecolearn.dev` | Registrar and renewal price are not represented in the repository | Put the domain in the sponsoring organization's account with auto-renew, MFA, recovery contacts, and a documented annual renewal budget | Before transferring ownership or announcing a long-lived public URL |

## Services present but not part of the active scanner path

- `classify-scan`, `second-opinion`, `review-feedback`, automated training, and
  Hugging Face promotion remain in the repository as legacy/experimental model
  infrastructure. The visible scanner feedback collector has been removed, so
  these should not be funded or scheduled until there is an approved data and
  model-improvement program.
- `generate-guidance` remains deployed by the current workflow but is not
  imported by the active platform UI. Retire it after confirming no external
  client depends on it; unused AI endpoints increase security and budget risk.
- The package-label reader is still an LLM feature and shares the OpenRouter
  account. Give it its own request log and limit before promoting it broadly.

## Budget scenarios for a DSWA conversation

These are planning ranges, not commitments.

### Small supervised pilot

| Item | Planning amount |
| --- | ---: |
| Supabase Pro | $25/month |
| OpenRouter paid credits | $25–$100/month, then adjust from actual cost/request |
| Production SMTP | $0–$20/month for pilot volume |
| Expo Starter during release months | $19/month |
| Production static hosting/CDN | $5–$25/month |
| Commercial maps, if nearby search is promoted | about $25/month starting point |
| Domain | registrar-specific annual renewal |
| Apple Developer Program | $99/year; eligible nonprofits, schools, and government entities can request Apple's fee waiver |
| Google Play full distribution | $25 one time |

**Indicative pilot operations:** roughly **$74–$214/month**, plus domain and
store accounts. The lower end excludes commercial maps and paid SMTP; the upper
end includes both and a larger AI reserve.

### 5,000-user web + app service

Assumptions: 5,000 registered users, about 2,500 monthly active users, 5,000
vision scans/month, no stored scan photos, compressed images, and ordinary
school-day bursts rather than 5,000 simultaneous users.

| Item | Monthly planning range |
| --- | ---: |
| Supabase Pro, default compute | $25 |
| Netlify Personal or Pro | $9-$20 |
| Resend Pro production SMTP | $20 |
| OpenRouter vision reserve | $10-$100; replace with measured cost/request |
| MapTiler Flex | $25 |
| Expo Starter or Production, depending on mobile update MAU | $19-$199 |
| Uptime/error monitoring | $0-$30 |
| **Estimated recurring platform total** | **$108-$419/month** |

### 10,000-user web + app service

Assumptions: 10,000 registered users, 5,000-7,500 monthly active users, 15,000
vision scans/month, 20,000 transactional emails/month, and classroom traffic
bursts. Supabase Pro still includes 100,000 MAU, 250 GB egress, and 8 GB disk;
upgrade compute only if measured latency/connections require it.

| Item | Monthly planning range |
| --- | ---: |
| Supabase Pro plus possible Small/Medium compute headroom | $25-$85 |
| Netlify Pro plus credit headroom | $20-$40 |
| Resend Pro | $20 |
| OpenRouter vision reserve | $30-$300; replace with measured cost/request |
| MapTiler Flex | $25 |
| Expo Starter with overage or Production | $19-$199 |
| Monitoring and incident alerting | $10-$30 |
| **Estimated recurring platform total** | **$149-$699/month** |

These totals exclude staff time. Add **$99/year** for Apple membership (or seek
the eligible nonprofit/education/government waiver), **$25 one time** for Google
Play full distribution, domain renewal, taxes, and one-time privacy, security,
accessibility, content, device-QA, and legal work. A DSWA-backed school launch
should budget those professional reviews separately; cloud bills alone do not
make an under-13 product production-ready.

## Cost and reliability controls to implement before scale

- [x] Authenticated scanner requests
- [x] Per-user hourly vision limit
- [x] Configurable scanner-wide daily vision ceiling
- [x] No automatic LLM retry loop
- [x] Deterministic catalog normalization; no second LLM categorization call
- [ ] OpenRouter production key with hard monthly budget and alerts
- [ ] Separate OpenRouter keys for development and production
- [ ] Replace the count-then-record ceiling with an atomic database budget
      reservation before a large concurrent pilot
- [ ] Confirm a ZDR-capable provider/model and enforce the approved data policy
- [ ] Log provider request ID, model, tokens, cost, latency, and status without storing image content
- [ ] Give label reading and any future AI endpoint its own per-user/global limits
- [ ] Supabase Pro, downloadable backup test, and restore drill
- [ ] Custom SMTP with SPF, DKIM, DMARC, bounce handling, and rate-limit review
- [ ] Error monitoring and uptime checks for web, functions, auth, and DNREC sync
- [ ] Web/CDN and map-provider load test
- [ ] Cache Open Food Facts barcode results and migrate from API v2 to v3
- [ ] Replace hourly training polling with an approved event/manual workflow
- [ ] Remove or disable unused AI Edge Functions

## Maintenance rule

Update this file in the same pull request whenever any of the following changes:

- a provider, API, SDK, hosting target, model, or paid plan;
- a scheduled workflow, external URL, environment variable, or secret;
- data retention, image handling, authentication, analytics, maps, or email;
- rate limits, cost controls, store distribution, or organization ownership.

At least quarterly, rerun these repository searches and verify every price link:

```powershell
rg -n "https?://|Deno.env|process.env|import.meta.env|EXPO_PUBLIC|secrets\." apps .github
rg -n "fetch\(|functions.invoke|createClient|schedule:" apps .github
```

Add a dated entry below with the reviewer and material changes.

## Review history

| Date | Reviewer | Change |
| --- | --- | --- |
| 2026-08-07 | Codex + project owner | Initial cross-platform service inventory, free-tier risks, DSWA budget scenarios, and LLM guardrails |
| 2026-08-20 | Codex + project owner | Corrected active hosting to Netlify, added current credit pricing, DSWA video dependency, and explicit 5,000/10,000-user planning ranges |

## Official pricing and policy references

- [Supabase pricing](https://supabase.com/pricing)
- [Supabase production checklist](https://supabase.com/docs/guides/deployment/going-into-prod)
- [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [OpenRouter pricing](https://openrouter.ai/pricing)
- [OpenRouter FAQ and free-model limits](https://openrouter.ai/docs/faq)
- [OpenRouter provider privacy/cost routing](https://openrouter.ai/docs/guides/routing/provider-selection)
- [OpenRouter Zero Data Retention](https://openrouter.ai/docs/guides/features/zdr)
- [Expo EAS pricing](https://expo.dev/pricing)
- [Expo plans and billing](https://docs.expo.dev/billing/plans/)
- [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
- [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
- [Netlify pricing and usage credits](https://www.netlify.com/pricing/)
- [OpenStreetMap tile policy](https://operations.osmfoundation.org/policies/tiles/)
- [Open Food Facts API limits](https://openfoodfacts.github.io/openfoodfacts-server/api/)
- [Hugging Face pricing](https://huggingface.co/pricing)
- [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [MapTiler Cloud pricing](https://www.maptiler.com/cloud/pricing/)
- [Resend pricing](https://resend.com/docs/knowledge-base/what-is-resend-pricing)
- [Apple Developer Program enrollment and fee](https://developer.apple.com/programs/enroll/)
- [Google Play Console registration](https://support.google.com/googleplay/android-developer/answer/6112435)
