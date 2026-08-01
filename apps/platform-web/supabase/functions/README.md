# Edge Function deployment

```powershell
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set CLASSIFIER_URL=https://aarugunj-waste-classifier.hf.space/predict
supabase secrets set ALLOWED_ORIGIN=https://app.ecolearn.dev
supabase functions deploy classify-scan
supabase functions deploy explain-scan
```

The function accepts authenticated requests only, forwards a user-selected image to the classifier, rejects non-images and files above 8 MB, and does not store image bytes.

## Delaware DNREC guidance

EcoLearn mirrors the official Delaware DNREC Recyclopedia dataset (location ID 38)
into Supabase. The visual model receives the official title catalog and can select
one exact title only; the app displays a rule only after that title is verified in
the official mirror. No match means no disposal recommendation.

1. Run `../migrations/202607310001_delaware_guidance.sql` in the Supabase SQL Editor.
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
   `x-dnrec-sync-secret: <your secret>`. The first run imports all 453 DNREC
   topics; later runs only refresh topics whose DNREC update timestamp changed.

The map function uses DNREC's item-filtered solution endpoint when it receives a
verified item name. Its older OpenStreetMap lookup remains as a clearly separate
fallback when the app has no exact item yet.
