# Edge Function deployment

```powershell
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set CLASSIFIER_URL=https://aarugunj-waste-classifier.hf.space/predict
supabase secrets set ALLOWED_ORIGIN=https://app.ecolearn.dev
supabase functions deploy classify-scan
supabase functions deploy explain-scan
```

The function accepts authenticated requests only, forwards a user-selected image to the classifier, rejects non-images and files above 8 MB, and does not store image bytes.
