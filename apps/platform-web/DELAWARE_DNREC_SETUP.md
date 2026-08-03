# Delaware DNREC guidance: deployment and verification

EcoLearn uses Delaware DNREC's Recyclopedia (location `38`) as the authority for
local disposal instructions and item-specific locations. Visual AI receives the
official topic catalog and may select one exact title only; it cannot invent an
item title or recycling rule. No verified match means no disposal recommendation.

## 1. Import the database schema

In Supabase **SQL Editor**, run the migrations in order:

1. [202607310001_delaware_guidance.sql](./supabase/migrations/202607310001_delaware_guidance.sql)
   creates the official guidance mirror and sync audit log.
2. [202608020001_secure_delaware_platform.sql](./supabase/migrations/202608020001_secure_delaware_platform.sql)
   moves scans, lesson completion, rewards, XP, and achievements behind
   server-controlled functions. It also creates the visual-check request log.

The security migration is rerunnable. If the accidental `ecoscan` copy was run
partially in SQL Editor, run this complete platform copy so the database and the
repository end in the same state.

## 2. Add protected secrets

In **Edge Functions → Secrets**, configure:

| Secret | Purpose |
| --- | --- |
| `DNREC_SYNC_SECRET` | Authorizes the background catalog importer. Use a new long random value. |
| `OPENROUTER_API_KEY` | Used only by the protected visual catalog matcher. Never use a `VITE_` or `EXPO_PUBLIC_` name. |
| `OPENROUTER_EXPLAIN_MODEL` | The OpenRouter vision model used for exact official-title selection. |
| `ALLOWED_ORIGIN` | The deployed EcoLearn web origin, such as `https://app.ecolearn.dev`. |

## 3. Deploy from GitHub

Run **Actions → Deploy EcoLearn Supabase functions → Run workflow**. Before the
first run, add these repository secrets under **Settings → Secrets and variables
→ Actions**:

| Secret | Value |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | A personal access token from Supabase Account → Access Tokens. |
| `SUPABASE_PROJECT_REF` | The short project reference from the project URL. |

The workflow deploys each function together with
`supabase/functions/_shared/dnrec.ts`, preserving the version-controlled shared
source. Do not paste an imported function into the Dashboard editor by itself.

## 4. Run the first official import

Add these repository secrets:

| Secret | Value |
| --- | --- |
| `SUPABASE_FUNCTIONS_URL` | `https://YOUR_PROJECT_REF.supabase.co/functions/v1` |
| `DNREC_SYNC_SECRET` | The same private value stored in Edge Function secrets. |

Run **Actions → Refresh official Delaware recycling guidance → Run workflow**.
The first import mirrors current official topics; daily runs refresh records
DNREC reports as changed. The manual workflow remains available after a policy
or program update.

## 5. Verify before publishing

In Supabase **Table Editor**, confirm `delaware_guidance_items` contains the
official catalog and `delaware_guidance_sync_runs` shows a completed run. Then,
while signed in to EcoLearn:

1. Search an exact item such as `Plastic Water Bottles`.
2. Confirm the result names Delaware DNREC Recyclopedia and opens its source.
3. Use **Check official Delaware item** on a clear, one-item photo. It must
   return an official protocol or no recommendation—never generic advice.
4. Open available locations and confirm the results are filtered for that item.
5. Repeat a saved request and confirm XP is awarded once only.
6. Complete a lesson with a correct answer and confirm a direct client-side
   progress update is rejected.
7. Trigger more than ten visual checks in an hour with a test account and
   confirm the function returns rate-limit status `429`.

Do not launch EcoLearn as a child-directed school product until the school or
district has approved the consent, retention, deletion, accessibility, and
teacher-managed account model. The in-app reminder not to scan faces, names,
schoolwork, or personal information does not replace that review.
