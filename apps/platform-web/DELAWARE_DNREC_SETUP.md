# Delaware DNREC guidance: deployment and verification

EcoLearn uses Delaware DNREC's Recyclopedia (location `38`) as the source for local disposal instructions and item-specific locations. The visual AI receives the official DNREC topic catalog and may select one exact title from that catalog only; it cannot invent an item title or a Delaware recycling rule. If no exact official match is verified, EcoLearn shows no disposal recommendation.

## 1. Import the database schema

In the Supabase Dashboard, open **SQL Editor** and run [202607310001_delaware_guidance.sql](./supabase/migrations/202607310001_delaware_guidance.sql). It creates the official guidance mirror and its sync audit log.

## 2. Add the protected sync secret

In **Edge Functions → Secrets**, add `DNREC_SYNC_SECRET`. Use a new long random value and keep it private. This secret authorizes the importer; it must never go in a browser `.env` file.

## 3. Deploy from GitHub, with no local CLI

Run **Actions → Deploy EcoLearn Supabase functions → Run workflow**. Before the first run, add these repository secrets under **Settings → Secrets and variables → Actions**:

| Secret | Value |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | A personal access token created in Supabase Account → Access Tokens. |
| `SUPABASE_PROJECT_REF` | The short project reference from the project URL, not the full URL. |

The action deploys the functions together with `supabase/functions/_shared/dnrec.ts`, so the source stays version-controlled. The Supabase Dashboard can also deploy an uploaded function source zip, but this workflow keeps the shared source intact and records deployments.

## 4. First official import and daily refresh

After deployment, add these repository secrets:

| Secret | Value |
| --- | --- |
| `SUPABASE_FUNCTIONS_URL` | `https://YOUR_PROJECT_REF.supabase.co/functions/v1` |
| `DNREC_SYNC_SECRET` | Exactly the same private value entered in Supabase Edge Function secrets. |

Run **Actions → Refresh official Delaware recycling guidance → Run workflow**. The first import mirrors current official topics; later daily runs fetch only records DNREC reports as changed. GitHub schedules are best-effort, so the manual workflow is also available whenever DNREC changes policy.

## 5. Verify before publishing

In Supabase **Table Editor**, `delaware_guidance_items` should contain hundreds of rows and `delaware_guidance_sync_runs` should show a completed run. Then, signed in to EcoLearn:

1. Search an exact item such as `5 gallon water jug` on Scan.
2. Confirm the result names **Delaware DNREC Recyclopedia** and opens an official source link.
3. Use **Check official Delaware item** on a clear, one-item photo. It must return an official DNREC protocol or say no protocol could be verified; it must never show generic disposal advice.
4. Open Nearby sites from a verified item. The listed places should come from DNREC's item-filtered map service.

Do not launch this as a child-directed school product until the district/parent consent process, data retention policy, and teacher-managed account model are agreed with the school or district. The in-app reminder not to scan faces, names, schoolwork, or personal information is helpful but is not a substitute for the school privacy review.
