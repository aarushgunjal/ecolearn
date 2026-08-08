# Edge Function deployment

```powershell
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set OPENROUTER_API_KEY=YOUR_PRIVATE_KEY
supabase secrets set OPENROUTER_EXPLAIN_MODEL=YOUR_VISION_MODEL
supabase secrets set ALLOWED_ORIGIN=https://app.ecolearn.dev
supabase functions deploy explain-scan
```

The primary scanner accepts authenticated requests only, sends one resized
user-selected image to the configured vision model, and asks only for a specific
visible item description. It then searches DNREC locally. It rejects unsupported
images and files above 8 MB and does not store image bytes. `classify-scan`
remains available only for legacy model evaluation and training workflows; the
EcoLearn web and signed-in mobile scanners do not call it.

## Delaware DNREC guidance

EcoLearn mirrors the official Delaware DNREC Recyclopedia dataset (location ID 38)
into Supabase. The visual model identifies an item without receiving or creating
disposal guidance. A conservative deterministic search maps that description to
the official mirror. The app displays a rule only after a strong, unique official
match. No match means no disposal recommendation.

1. Run these migrations in order in the Supabase SQL Editor:

   - `../migrations/202607310001_delaware_guidance.sql`
   - `../migrations/202608020001_secure_delaware_platform.sql`
   - `../migrations/202608070001_vision_scanner_feedback.sql`

   The security migration is rerunnable. It moves XP, lesson grading, rewards,
   and official scan recording behind authenticated server functions, and adds
   per-user visual lookup limits.
2. In Edge Function Secrets, add a long random `DNREC_SYNC_SECRET`.
3. Deploy these functions together with `_shared/dnrec.ts`. The recommended
   no-local-CLI option is the repository's **Deploy EcoLearn Supabase functions**
   GitHub Action; the full secret list and verification steps are in
   [DELAWARE_DNREC_SETUP.md](../../DELAWARE_DNREC_SETUP.md).

   CLI equivalent:

   ```powershell
   supabase functions deploy sync-delaware-recyclopedia
   supabase functions deploy delaware-guidance
   supabase functions deploy explain-scan
   supabase functions deploy find-disposal-sites
   ```

4. Invoke `sync-delaware-recyclopedia` once with `POST` and the header
   `x-dnrec-sync-secret: <your secret>`. The first run imports the current DNREC
   catalog; later runs only refresh topics whose DNREC update timestamp changed.

The map function uses DNREC's item-filtered solution endpoint when it receives a
verified item name. Its older OpenStreetMap lookup remains as a clearly separate
fallback when the app has no exact item yet.

## Account deletion

`delete-account` requires a valid user JWT plus the explicit JSON confirmation
`{ "confirmation": "DELETE" }`. It removes the user's consented training-photo
objects first, then deletes the Supabase Auth user. Database records tied to the
user are removed by the existing `on delete cascade` constraints. The service
role key is supplied automatically by Supabase and must never be exposed in the
mobile or web client.
