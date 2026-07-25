# Scanner proxy deployment

After applying `supabase/migrations/202607250001_scan_feedback.sql` to your new project:

```powershell
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set CLASSIFIER_URL=https://aarugunj-waste-classifier.hf.space/predict
supabase secrets set ALLOWED_ORIGIN=https://scan.ecolearn.dev
supabase functions deploy classify-scan
```

The function requires an authenticated user, forwards only the selected image to the classifier, rejects non-images and files above 8 MB, and does not retain image bytes.
